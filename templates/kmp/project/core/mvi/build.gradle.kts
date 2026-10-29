plugins {
    alias(libs.plugins.com.acme.shop.core.compose)
}

// Namespace, SDK levels, coroutines, lifecycle and test dependencies come from the core.compose convention plugin.
// This module owns the MVI-by-delegate base (MVI, MVIDelegate, BaseViewModel, CollectSideEffect) and nothing else.
