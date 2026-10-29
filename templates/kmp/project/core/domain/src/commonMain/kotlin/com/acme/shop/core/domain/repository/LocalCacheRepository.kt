package com.acme.shop.core.domain.repository

import com.acme.shop.core.domain.AppResult
import com.acme.shop.core.domain.model.CachedItem
import kotlinx.coroutines.flow.Flow

interface LocalCacheRepository {
    fun observeItems(): Flow<AppResult<List<CachedItem>>>
    suspend fun upsertItem(item: CachedItem): Flow<AppResult<Unit>>
    suspend fun removeItem(itemId: Int): Flow<AppResult<Unit>>
    suspend fun clear(): Flow<AppResult<Unit>>
}
