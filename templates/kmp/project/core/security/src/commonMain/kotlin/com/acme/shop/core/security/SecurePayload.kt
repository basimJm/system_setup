package com.acme.shop.core.security

import kotlin.io.encoding.Base64

private const val SEPARATOR = ':'

/** Wire form of an AES-GCM ciphertext in preferences: `base64(iv):base64(cipherText)`. */
data class SecurePayload(val iv: ByteArray, val cipherText: ByteArray) {

    fun pack(): String = Base64.encode(iv) + SEPARATOR + Base64.encode(cipherText)

    override fun equals(other: Any?): Boolean =
        other is SecurePayload && iv.contentEquals(other.iv) && cipherText.contentEquals(other.cipherText)

    override fun hashCode(): Int = iv.contentHashCode() * HASH_MULTIPLIER + cipherText.contentHashCode()

    companion object {
        private const val HASH_MULTIPLIER = 31

        /** Null for anything that is not a well-formed payload (legacy or tampered entries are dropped, not crashed on). */
        fun unpack(packed: String): SecurePayload? {
            val index = packed.indexOf(SEPARATOR)
            if (index <= 0 || index == packed.lastIndex) return null
            return try {
                SecurePayload(Base64.decode(packed.substring(0, index)), Base64.decode(packed.substring(index + 1)))
            } catch (ignored: IllegalArgumentException) {
                null
            }
        }
    }
}
