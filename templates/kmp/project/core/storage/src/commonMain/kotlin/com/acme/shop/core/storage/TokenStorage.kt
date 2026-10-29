package com.acme.shop.core.storage

interface SessionStorage {
    suspend fun getRole(): String?
    suspend fun setRole(role: String?)
    suspend fun getUserId(): String?
    suspend fun setUserId(userId: String?)
}

class InMemorySessionStorage : SessionStorage {
    private var role: String? = null
    private var userId: String? = null
    override suspend fun getRole(): String? = role
    override suspend fun setRole(role: String?) {
        this@InMemorySessionStorage.role = role
    }

    override suspend fun getUserId(): String? = userId
    override suspend fun setUserId(userId: String?) {
        this@InMemorySessionStorage.userId = userId
    }
}
