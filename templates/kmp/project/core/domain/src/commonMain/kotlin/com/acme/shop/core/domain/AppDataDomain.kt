package com.acme.shop.core.domain

interface AppDataDomain<out T> {
    fun toDomain(): T
    fun toDomain(isArabic: Boolean = false): T = toDomain()
}
