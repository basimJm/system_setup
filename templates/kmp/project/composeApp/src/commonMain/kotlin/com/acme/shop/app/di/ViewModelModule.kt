package com.acme.shop.app.di

import com.acme.shop.app.controller.vm.MainViewModel
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module

/** Explicit constructor call: the test-scope seam of the view model is not a Koin type. */
val viewModelModule = module {
    viewModel {
        MainViewModel(
            appSettings = get(),
            appearanceSettings = get(),
            sessionTimeOut = get(),
            environment = get(),
            sessionAnalyticsSync = get(),
        )
    }
}
