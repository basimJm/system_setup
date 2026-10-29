package com.acme.shop.core.security

import java.nio.charset.StandardCharsets
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

actual class Encryptor actual constructor(
    private val algorithm: Algorithm,
    private val passPhrase: String,
    private val salt: String,
    private val transformation: String,
) {
    actual fun encrypt(message: String): String {
        return when (algorithm) {
            Algorithm.AES -> encryptAES(message)
            Algorithm.CHA_CHA -> "NOT IMPLEMENTED"
        }
    }

    actual fun decrypt(message: String): String {
        return when (algorithm) {
            Algorithm.AES -> decryptAES(message)
            Algorithm.CHA_CHA -> "NOT IMPLEMENTED"
        }
    }

    private fun encryptAES(value: String): String {
        if (value.isEmpty()) return ""
        val secretKey = SecretKeySpec(passPhrase.toByteArray(StandardCharsets.UTF_8), Algorithm.AES.name)
        val cipher = Cipher.getInstance(transformation)
        val ivSpec = IvParameterSpec(salt.toByteArray(StandardCharsets.UTF_8))
        cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivSpec)
        val encryptedBytes = cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
        return Base64.getEncoder().encodeToString(encryptedBytes)
    }

    private fun decryptAES(ciphertext: String): String {
        val secretKey = SecretKeySpec(passPhrase.toByteArray(StandardCharsets.UTF_8), Algorithm.AES.name)
        val cipher = Cipher.getInstance(transformation)
        val ivSpec = IvParameterSpec(salt.toByteArray(StandardCharsets.UTF_8))
        cipher.init(Cipher.DECRYPT_MODE, secretKey, ivSpec)
        val encryptedBytes = Base64.getDecoder().decode(ciphertext)
        val decryptedBytes = cipher.doFinal(encryptedBytes)
        return String(decryptedBytes, StandardCharsets.UTF_8)
    }
}
