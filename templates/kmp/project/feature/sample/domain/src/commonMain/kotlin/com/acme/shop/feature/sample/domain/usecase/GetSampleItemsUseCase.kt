package com.acme.shop.feature.sample.domain.usecase

import com.acme.shop.core.domain.AppResult
import com.acme.shop.feature.sample.domain.model.SampleItem
import com.acme.shop.feature.sample.domain.repository.SampleRepository
import kotlinx.coroutines.flow.Flow

class GetSampleItemsUseCase(private val repository: SampleRepository) {
    operator fun invoke(): Flow<AppResult<List<SampleItem>>> = repository.getItems()
}
