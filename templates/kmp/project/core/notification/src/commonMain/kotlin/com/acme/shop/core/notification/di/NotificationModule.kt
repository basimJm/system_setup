package com.acme.shop.core.notification.di

import com.acme.shop.core.notification.state.NotificationViewModel
import org.koin.core.module.dsl.viewModelOf
import org.koin.dsl.module

val notificationModule = module {
    viewModelOf(::NotificationViewModel)
}
