package com.acme.shop.core.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class PagingConfigTest {
    @Test
    fun pagesHoldTenItemsAsThePrdRequires() {
        assertEquals(10, PagingDefaults.PAGE_SIZE)
        assertEquals(PagingDefaults.PAGE_SIZE, DefaultPagingConfig.pageSize)
        assertEquals(PagingDefaults.PAGE_SIZE, DefaultPagingConfig.initialLoadSize)
        assertEquals(PagingDefaults.PREFETCH_DISTANCE, DefaultPagingConfig.prefetchDistance)
        assertFalse(DefaultPagingConfig.enablePlaceholders)
    }
}
