package com.acme.shop.core.data

@kotlinx.serialization.Serializable
data class PageableDto<T>(
    @kotlinx.serialization.SerialName("current_page")
    val currentPage: Int? = null,

    @kotlinx.serialization.SerialName("data")
    val data: List<T>,  

    @kotlinx.serialization.SerialName("first_page_url")
    val firstPageUrl: String? = null,

    @kotlinx.serialization.SerialName("from")
    val from: Int? = null,

    @kotlinx.serialization.SerialName("last_page")
    val lastPage: Int? = null,

    @kotlinx.serialization.SerialName("last_page_url")
    val lastPageUrl: String? = null,

    @kotlinx.serialization.SerialName("next_page_url")
    val nextPageUrl: String? = null,

    @kotlinx.serialization.SerialName("path")
    val path: String? = null,

    @kotlinx.serialization.SerialName("per_page")
    val perPage: Int? = null,

    @kotlinx.serialization.SerialName("prev_page_url")
    val prevPageUrl: String? = null,

    @kotlinx.serialization.SerialName("to")
    val to: Int? = null,

    @kotlinx.serialization.SerialName("total")
    val total: Int? = null
)
