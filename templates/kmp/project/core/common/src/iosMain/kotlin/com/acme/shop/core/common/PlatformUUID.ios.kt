package com.acme.shop.core.common

import platform.Foundation.NSUUID

actual fun randomUUID(): String = NSUUID().UUIDString()
