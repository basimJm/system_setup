package com.acme.shop.feature.sample.data.di

import com.acme.shop.core.data.mock.MockFixture
import com.acme.shop.feature.sample.data.remote.service.SampleApiService
import com.acme.shop.feature.sample.data.remote.service.SampleApiServiceImpl
import com.acme.shop.feature.sample.data.repository.SampleRepositoryImpl
import com.acme.shop.feature.sample.data.utils.SampleEndPoints
import com.acme.shop.feature.sample.data.utils.SampleFixtures
import com.acme.shop.feature.sample.domain.repository.SampleRepository
import org.koin.core.qualifier.named
import org.koin.dsl.module

val sampleDataModule = module {
    single<SampleApiService> { SampleApiServiceImpl(get()) }
    single<SampleRepository> { SampleRepositoryImpl(get()) }
    // Served only when DATA_SOURCE = mock (dev builds); one fixture per endpoint of the feature.
    single(named(SampleFixtures.QUALIFIER)) { MockFixture(SampleFixtures.METHOD_GET, SampleEndPoints.ITEMS, SampleFixtures.ITEMS) }
}
