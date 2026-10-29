package com.acme.shop.core.ui.permission

import com.acme.shop.core.ui.media.ImagePicker
import com.acme.shop.core.ui.media.IosImagePicker
import org.koin.core.module.Module
import org.koin.dsl.module

actual val platformPermissionModule: Module = module {
    single<PermissionManager> { IosPermissionManager() }
    single<ImagePicker> { IosImagePicker() }
}
