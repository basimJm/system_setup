package com.acme.shop.core.ui.permission

import android.content.Context
import com.acme.shop.core.ui.media.AndroidImagePicker
import com.acme.shop.core.ui.media.AndroidImagePickerBridge
import com.acme.shop.core.ui.media.ImagePicker
import org.koin.core.module.Module
import org.koin.dsl.module

actual val platformPermissionModule: Module = module {
    single { AndroidPermissionBridge() }
    single<PermissionManager> { AndroidPermissionManager(get<Context>(), get()) }
    single { AndroidImagePickerBridge() }
    single<ImagePicker> { AndroidImagePicker(get<Context>(), get()) }
}
