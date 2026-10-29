package com.acme.shop.core.common

class StrValidator {
    fun isEmpty(str: String?): Boolean = (str?.isEmpty()) ?: false
    fun isAllDigits(str: String?): Boolean = str?.all { it.isDigit() } == true
    fun isValidEmail(str: String): Boolean =
        str.isNotBlank() && Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$").matches(str.trim())

    fun isValidPassword(str: String): Boolean =
        str.any { it.isLetter() } && str.any { it.isDigit() } && str.any { it.isLowerCase() } && str.any { it.isUpperCase() } && str.any { !it.isLetterOrDigit() && !it.isWhitespace() }
}
