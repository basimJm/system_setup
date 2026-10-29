package com.acme.shop.core.security

actual class Encryptor actual constructor(
    private val algorithm: Algorithm,
    private val passPhrase: String,
    private val salt: String,
    private val transformation: String,
) {
    actual fun encrypt(message: String): String {
        // TODO: Implement using CommonCrypto
        return message
    }

    actual fun decrypt(message: String): String {
        // TODO: Implement using CommonCrypto
        return message
    }
}
