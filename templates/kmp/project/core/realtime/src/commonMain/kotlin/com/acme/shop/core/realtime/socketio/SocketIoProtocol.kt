package com.acme.shop.core.realtime.socketio

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

private const val ENGINE_OPEN = '0'
private const val ENGINE_CLOSE = '1'
private const val ENGINE_PING = '2'
private const val ENGINE_PONG = '3'
private const val ENGINE_MESSAGE = '4'
private const val SOCKET_CONNECT = '0'
private const val SOCKET_DISCONNECT = '1'
private const val SOCKET_EVENT = '2'
private const val SOCKET_CONNECT_ERROR = '4'
private const val ROOT_NAMESPACE = "/"
private const val NAMESPACE_END = ','
private const val NAMESPACE_START = '/'
private const val FIELD_PING_INTERVAL = "pingInterval"
private const val FIELD_PING_TIMEOUT = "pingTimeout"
private const val FIELD_TOKEN = "token"
private const val FIELD_MESSAGE = "message"
private const val FIELD_DATA = "data"
private const val FIELD_CODE = "code"

/** Engine.IO v4 text frames as the client sees them. */
sealed interface EngineIoPacket {
    data class Open(val pingIntervalMs: Long?, val pingTimeoutMs: Long?) : EngineIoPacket
    data object Close : EngineIoPacket
    data object Ping : EngineIoPacket
    data object Pong : EngineIoPacket
    data class Message(val packet: SocketIoPacket) : EngineIoPacket
    data class Unknown(val raw: String) : EngineIoPacket
}

/** Socket.IO v4 packets (`<type>[namespace,][ack id][json]`); acks and binary attachments are not used by the server. */
sealed interface SocketIoPacket {
    val namespace: String

    data class Connect(override val namespace: String, val auth: JsonObject) : SocketIoPacket
    data class Connected(override val namespace: String) : SocketIoPacket
    data class Disconnect(override val namespace: String) : SocketIoPacket
    data class Event(override val namespace: String, val name: String, val payload: JsonElement) : SocketIoPacket

    /** [code] is the server's `data.code` (`UNAUTHORIZED`, `FORBIDDEN`, `UNAVAILABLE`), else the message. */
    data class ConnectError(override val namespace: String, val code: String?) : SocketIoPacket
    data class Unknown(override val namespace: String, val raw: String) : SocketIoPacket
}

/** Pure codec; malformed frames become `Unknown`, never exceptions. */
class SocketIoProtocol(private val json: Json = Json { ignoreUnknownKeys = true }) {

    fun decode(frame: String): EngineIoPacket {
        val body = frame.drop(1)
        return when (frame.firstOrNull()) {
            ENGINE_OPEN -> decodeOpen(body)
            ENGINE_CLOSE -> EngineIoPacket.Close
            ENGINE_PING -> EngineIoPacket.Ping
            ENGINE_PONG -> EngineIoPacket.Pong
            ENGINE_MESSAGE -> EngineIoPacket.Message(decodeSocketIo(body))
            else -> EngineIoPacket.Unknown(frame)
        }
    }

    fun encodePong(): String = ENGINE_PONG.toString()

    fun encodeConnect(namespace: String, token: String): String {
        val auth = buildJsonObject { put(FIELD_TOKEN, JsonPrimitive(token)) }
        return "$ENGINE_MESSAGE$SOCKET_CONNECT${namespacePrefix(namespace)}${json.encodeToString(JsonObject.serializer(), auth)}"
    }

    fun encodeEvent(namespace: String, name: String, payload: JsonElement = JsonNull): String {
        val array = buildJsonArray {
            add(JsonPrimitive(name))
            if (payload != JsonNull) add(payload)
        }
        return "$ENGINE_MESSAGE$SOCKET_EVENT${namespacePrefix(namespace)}$array"
    }

    private fun namespacePrefix(namespace: String): String =
        if (namespace == ROOT_NAMESPACE || namespace.isEmpty()) "" else "$namespace$NAMESPACE_END"

    private fun decodeOpen(body: String): EngineIoPacket {
        val fields = parseObject(body) ?: return EngineIoPacket.Open(null, null)
        return EngineIoPacket.Open(
            pingIntervalMs = fields[FIELD_PING_INTERVAL]?.jsonPrimitive?.longOrNull,
            pingTimeoutMs = fields[FIELD_PING_TIMEOUT]?.jsonPrimitive?.longOrNull,
        )
    }

    private fun decodeSocketIo(body: String): SocketIoPacket {
        val type = body.firstOrNull()
        var rest = body.drop(1)
        var namespace = ROOT_NAMESPACE
        if (rest.startsWith(NAMESPACE_START)) {
            val end = rest.indexOf(NAMESPACE_END)
            if (end > 0) {
                namespace = rest.substring(0, end)
                rest = rest.substring(end + 1)
            }
        }
        val data = rest.dropWhile { it.isDigit() }
        return when (type) {
            SOCKET_CONNECT -> SocketIoPacket.Connected(namespace)
            SOCKET_DISCONNECT -> SocketIoPacket.Disconnect(namespace)
            SOCKET_EVENT -> decodeEvent(namespace, data)
            SOCKET_CONNECT_ERROR -> decodeConnectError(namespace, data)
            else -> SocketIoPacket.Unknown(namespace, body)
        }
    }

    private fun decodeEvent(namespace: String, data: String): SocketIoPacket {
        val array = parseElement(data)?.takeIf { it is kotlinx.serialization.json.JsonArray }?.jsonArray
        val name = array?.firstOrNull()?.jsonPrimitive?.contentOrNull
            ?: return SocketIoPacket.Unknown(namespace, data)
        return SocketIoPacket.Event(namespace, name, array.getOrNull(1) ?: JsonNull)
    }

    private fun decodeConnectError(namespace: String, data: String): SocketIoPacket {
        val fields = parseObject(data)
        val code = fields?.get(FIELD_DATA)?.let { it as? JsonObject }?.get(FIELD_CODE)?.jsonPrimitive?.contentOrNull
            ?: fields?.get(FIELD_MESSAGE)?.jsonPrimitive?.contentOrNull
        return SocketIoPacket.ConnectError(namespace, code)
    }

    private fun parseObject(text: String): JsonObject? = parseElement(text)?.let { it as? JsonObject }?.jsonObject

    private fun parseElement(text: String): JsonElement? = try {
        if (text.isBlank()) null else json.parseToJsonElement(text)
    } catch (ignored: IllegalArgumentException) {
        null
    }
}
