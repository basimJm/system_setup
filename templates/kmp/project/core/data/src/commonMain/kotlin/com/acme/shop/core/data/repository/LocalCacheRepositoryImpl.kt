package com.acme.shop.core.data.repository

import com.acme.shop.core.data.mapper.toDomain
import com.acme.shop.core.data.mapper.toEntity
import com.acme.shop.core.domain.AppError
import com.acme.shop.core.domain.AppResult
import com.acme.shop.core.domain.model.CachedItem
import com.acme.shop.core.domain.repository.LocalCacheRepository
import com.acme.shop.core.storage.db.dao.CachedItemDao
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart

class LocalCacheRepositoryImpl(private val dao: CachedItemDao) : LocalCacheRepository {

    override fun observeItems(): Flow<AppResult<List<CachedItem>>> {
        return dao.observeAll()
            .map { entities -> entities.map { it.toDomain() } }
            .map<List<CachedItem>, AppResult<List<CachedItem>>> { AppResult.Success(it) }
            .catch { emit(AppResult.Error(AppError.ParseError(it.message))) }
            .onStart { emit(AppResult.Loading) }
    }

    override suspend fun upsertItem(item: CachedItem): Flow<AppResult<Unit>> = flow {
        emit(AppResult.Loading)
        try {
            dao.upsert(item.toEntity())
            emit(AppResult.Success(Unit))
        } catch (e: Exception) {
            emit(AppResult.Error(AppError.ParseError(e.message)))
        }
    }

    override suspend fun removeItem(itemId: Int): Flow<AppResult<Unit>> = flow {
        emit(AppResult.Loading)
        try {
            dao.deleteById(itemId)
            emit(AppResult.Success(Unit))
        } catch (e: Exception) {
            emit(AppResult.Error(AppError.ParseError(e.message)))
        }
    }

    override suspend fun clear(): Flow<AppResult<Unit>> = flow {
        emit(AppResult.Loading)
        try {
            dao.deleteAll()
            emit(AppResult.Success(Unit))
        } catch (e: Exception) {
            emit(AppResult.Error(AppError.ParseError(e.message)))
        }
    }
}
