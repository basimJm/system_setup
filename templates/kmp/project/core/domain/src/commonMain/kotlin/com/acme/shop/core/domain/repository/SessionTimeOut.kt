package com.acme.shop.core.domain.repository

import kotlinx.coroutines.channels.Channel

interface SessionTimeOut {
    val sessionEventTimeOut: Channel<Boolean>
    suspend fun sendSessionTimeOut(isTimeOut: Boolean)
}
