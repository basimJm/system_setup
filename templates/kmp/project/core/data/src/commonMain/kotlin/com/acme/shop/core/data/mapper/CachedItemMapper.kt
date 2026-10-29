package com.acme.shop.core.data.mapper

import com.acme.shop.core.domain.model.CachedItem
import com.acme.shop.core.storage.db.entity.CachedItemEntity

fun CachedItem.toEntity(): CachedItemEntity = CachedItemEntity(
    id = id,
    title = title,
    description = description,
    updatedAt = updatedAt,
)

fun CachedItemEntity.toDomain(): CachedItem = CachedItem(
    id = id,
    title = title,
    description = description,
    updatedAt = updatedAt,
)
