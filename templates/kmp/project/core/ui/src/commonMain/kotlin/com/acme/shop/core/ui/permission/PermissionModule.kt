package com.acme.shop.core.ui.permission

import org.koin.core.module.Module
import org.koin.dsl.module

/** Binds [PermissionManager] for the current platform. */
expect val platformPermissionModule: Module

val permissionModule = module {
    includes(platformPermissionModule)
    single { PermissionFlow(get()) }
}
