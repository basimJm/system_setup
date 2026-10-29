package com.acme.shop.feature.sample.data.repository

import com.acme.shop.core.domain.AppResult
import com.acme.shop.core.network.safeApiCall
import com.acme.shop.feature.sample.data.remote.dto.toDomain
import com.acme.shop.feature.sample.data.remote.service.SampleApiService
import com.acme.shop.feature.sample.domain.model.SampleItem
import com.acme.shop.feature.sample.domain.repository.SampleRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class SampleRepositoryImpl(
    private val apiService: SampleApiService,
) : SampleRepository {

    override fun getItems(): Flow<AppResult<List<SampleItem>>> = flow {
        emit(AppResult.Loading)
        when (val response = safeApiCall { apiService.getItems() }) {
            is AppResult.Loading -> emit(AppResult.Loading)
            is AppResult.Error -> emit(AppResult.Error(response.appError))
            is AppResult.Success -> emit(
                AppResult.Success(response.data.data.map { it.toDomain() })
            )
        }
    }
}
