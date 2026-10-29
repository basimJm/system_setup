package com.acme.shop.core.data

import androidx.paging.PagingConfig

/** every server list is paginated with 10 items per page and infinite scroll. */
object PagingDefaults {
    const val PAGE_SIZE = 10
    const val PREFETCH_DISTANCE = 3
}

val DefaultPagingConfig = PagingConfig(
    pageSize = PagingDefaults.PAGE_SIZE,
    prefetchDistance = PagingDefaults.PREFETCH_DISTANCE,
    enablePlaceholders = false,
    initialLoadSize = PagingDefaults.PAGE_SIZE,
)
