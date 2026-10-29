package com.acme.shop.core.security

import platform.Foundation.CFBridgingRelease
import platform.Foundation.CFBridgingRetain
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.ptr
import kotlinx.cinterop.readBytes
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import platform.CoreFoundation.CFDictionaryAddValue
import platform.CoreFoundation.CFDictionaryCreateMutable
import platform.CoreFoundation.CFMutableDictionaryRef
import platform.CoreFoundation.CFRelease
import platform.CoreFoundation.CFTypeRef
import platform.CoreFoundation.CFTypeRefVar
import platform.CoreFoundation.kCFBooleanTrue
import platform.CoreFoundation.kCFTypeDictionaryKeyCallBacks
import platform.CoreFoundation.kCFTypeDictionaryValueCallBacks
import platform.Foundation.NSData
import platform.Foundation.create
import platform.Security.SecItemAdd
import platform.Security.SecItemCopyMatching
import platform.Security.SecItemDelete
import platform.Security.errSecSuccess
import platform.Security.kSecAttrAccessible
import platform.Security.kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword
import platform.Security.kSecMatchLimit
import platform.Security.kSecMatchLimitOne
import platform.Security.kSecReturnData
import platform.Security.kSecValueData

/** Generic-password Keychain items, one per key, scoped to [service]; readable after the first unlock, this device only. */
@OptIn(ExperimentalForeignApi::class)
class KeychainSecureStore(private val service: String) : SecureKeyValueStore {

    override suspend fun read(key: String): String? = memScoped {
        val result = alloc<CFTypeRefVar>()
        val status = withQuery(key) { query ->
            CFDictionaryAddValue(query, kSecReturnData, kCFBooleanTrue)
            CFDictionaryAddValue(query, kSecMatchLimit, kSecMatchLimitOne)
            SecItemCopyMatching(query, result.ptr)
        }
        if (status != errSecSuccess) return@memScoped null
        val data = CFBridgingRelease(result.value) as? NSData ?: return@memScoped null
        data.toByteArray().decodeToString()
    }

    override suspend fun write(key: String, value: String?) {
        withQuery(key) { query -> SecItemDelete(query) }
        val data = value?.encodeToByteArray()?.toNSData() ?: return
        val cfData = CFBridgingRetain(data)
        withQuery(key) { query ->
            CFDictionaryAddValue(query, kSecValueData, cfData)
            CFDictionaryAddValue(query, kSecAttrAccessible, kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
            SecItemAdd(query, null)
        }
        CFRelease(cfData)
    }

    private inline fun <T> withQuery(key: String, block: (CFMutableDictionaryRef?) -> T): T {
        val query = CFDictionaryCreateMutable(null, 0, kCFTypeDictionaryKeyCallBacks.ptr, kCFTypeDictionaryValueCallBacks.ptr)
        val cfService: CFTypeRef? = CFBridgingRetain(service)
        val cfKey: CFTypeRef? = CFBridgingRetain(key)
        CFDictionaryAddValue(query, kSecClass, kSecClassGenericPassword)
        CFDictionaryAddValue(query, kSecAttrService, cfService)
        CFDictionaryAddValue(query, kSecAttrAccount, cfKey)
        try {
            return block(query)
        } finally {
            CFRelease(cfService)
            CFRelease(cfKey)
            CFRelease(query)
        }
    }
}

@OptIn(ExperimentalForeignApi::class)
private fun NSData.toByteArray(): ByteArray = bytes?.readBytes(length.toInt()) ?: ByteArray(0)

// NSData.create(bytes:length:) is the only allocation-free bridge from Kotlin bytes; beta interop API opted in.
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
private fun ByteArray.toNSData(): NSData =
    if (isEmpty()) NSData() else usePinned { NSData.create(bytes = it.addressOf(0), length = size.toULong()) }
