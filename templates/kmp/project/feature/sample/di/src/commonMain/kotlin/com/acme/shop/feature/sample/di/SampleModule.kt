package com.acme.shop.feature.sample.di

import com.acme.shop.feature.sample.data.di.sampleDataModule
import com.acme.shop.feature.sample.domain.usecase.GetSampleItemsUseCase
import org.koin.core.module.dsl.singleOf
import org.koin.dsl.module

val sampleModule = module {
    includes(sampleDataModule)
    singleOf(::GetSampleItemsUseCase)
}
