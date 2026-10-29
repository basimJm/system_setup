package com.acme.shop.core.domain.model

import kotlinx.serialization.Serializable

@Serializable
data class NameModel(
    val ar: String,
    val en: String
)
