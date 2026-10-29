package com.acme.shop.core.data.repository

import com.acme.shop.core.domain.repository.SessionTimeOut
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.IO
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.withContext

class SessionTimeOutImpl : SessionTimeOut {
    private val _sessionEventTimeOut = Channel<Boolean>(Channel.CONFLATED)
    override val sessionEventTimeOut: Channel<Boolean> = _sessionEventTimeOut
    override suspend fun sendSessionTimeOut(isTimeOut: Boolean) {
        withContext(Dispatchers.IO) {
            _sessionEventTimeOut.trySend(isTimeOut)
        }
    }
}
