package com.acme.shop.core.domain.session

/** Signed-in user facts kept locally; the id keys analytics and crash reports, never the name. */
data class UserProfile(
    val id: String,
    val firstName: String,
)

/** Who is using the app right now; derived from the session store, never built by features. */
sealed interface SessionState {
    val isSignedIn: Boolean

    data object Guest : SessionState {
        override val isSignedIn: Boolean get() = false
    }

    data class SignedIn(val user: UserProfile) : SessionState {
        override val isSignedIn: Boolean get() = true
    }
}
