package com.acme.shop.feature.sample.domain.repository

import com.acme.shop.core.domain.AppResult
import com.acme.shop.feature.sample.domain.model.SampleItem
import kotlinx.coroutines.flow.Flow

interface SampleRepository {
    fun getItems(): Flow<AppResult<List<SampleItem>>>
}
