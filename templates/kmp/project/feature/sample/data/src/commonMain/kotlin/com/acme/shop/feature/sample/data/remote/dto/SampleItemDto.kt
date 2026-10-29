package com.acme.shop.feature.sample.data.remote.dto

import com.acme.shop.feature.sample.domain.model.SampleItem
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SampleItemDto(
    @SerialName("id") val id: Int? = null,
    @SerialName("title") val title: String? = null,
    @SerialName("description") val description: String? = null,
)

fun SampleItemDto.toDomain(): SampleItem = SampleItem(
    id = id ?: 0,
    title = title.orEmpty(),
    description = description.orEmpty(),
)
