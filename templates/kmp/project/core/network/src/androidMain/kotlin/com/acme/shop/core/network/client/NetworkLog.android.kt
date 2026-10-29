package com.acme.shop.core.network.client

import android.util.Log

internal actual fun networkLog(message: String) {
    Log.d("BaseKMPNetwork", message)
}
