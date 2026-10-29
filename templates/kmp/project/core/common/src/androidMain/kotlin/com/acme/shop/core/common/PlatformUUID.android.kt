package com.acme.shop.core.common

import java.util.UUID

actual fun randomUUID() = UUID.randomUUID().toString()
