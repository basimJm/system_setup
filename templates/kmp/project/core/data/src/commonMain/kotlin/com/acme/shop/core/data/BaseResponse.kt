package com.acme.shop.core.data

import kotlinx.serialization.Serializable

/** Base success envelope of the backend (`Acme-Server/CLAUDE.md` §6): `{ success, message, data, meta? }`. */
@Serializable
data class BaseResponse<T>(
    val success: Boolean,
    val message: String? = null,
    val data: T,
    val meta: PaginationMetaDto? = null,
)

/** `meta` of paginated lists: page size 10; `hasMore` drives the infinite scroll. */
@Serializable
data class PaginationMetaDto(
    val page: Int,
    val pageSize: Int,
    val total: Int,
) {
    val hasMore: Boolean get() = page * pageSize < total
}
