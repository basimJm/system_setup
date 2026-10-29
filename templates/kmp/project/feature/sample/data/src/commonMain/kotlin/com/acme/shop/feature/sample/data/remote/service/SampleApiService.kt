package com.acme.shop.feature.sample.data.remote.service

import com.acme.shop.core.data.BaseResponse
import com.acme.shop.feature.sample.data.remote.dto.SampleItemDto

interface SampleApiService {
    suspend fun getItems(): BaseResponse<List<SampleItemDto>>
}
