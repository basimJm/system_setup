package com.acme.shop.core.network.client

internal actual fun networkLog(message: String) {
    println("BaseKMPNetwork: $message")
}
