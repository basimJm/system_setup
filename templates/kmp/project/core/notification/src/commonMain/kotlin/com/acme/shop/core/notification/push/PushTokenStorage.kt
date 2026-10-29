package com.acme.shop.core.notification.push

interface PushTokenStorage {
    suspend fun savePushToken(token: String)
    suspend fun getPushToken(): String?
}
