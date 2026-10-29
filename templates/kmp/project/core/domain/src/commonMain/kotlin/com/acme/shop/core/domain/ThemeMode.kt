package com.acme.shop.core.domain

enum class ThemeMode {
    LIGHT,
    DARK,
    SYSTEM;

    companion object {
        fun fromString(value: String): ThemeMode {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: SYSTEM
        }
    }
}
