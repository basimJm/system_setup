package com.acme.shop.core.storage.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.acme.shop.core.storage.db.entity.CachedItemEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CachedItemDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(item: CachedItemEntity): Long

    @Query("SELECT * FROM cached_items")
    fun observeAll(): Flow<List<CachedItemEntity>>

    @Query("SELECT * FROM cached_items WHERE id = :id")
    suspend fun getById(id: Int): CachedItemEntity?

    @Query("DELETE FROM cached_items WHERE id = :id")
    suspend fun deleteById(id: Int)

    @Query("DELETE FROM cached_items")
    suspend fun deleteAll()
}
