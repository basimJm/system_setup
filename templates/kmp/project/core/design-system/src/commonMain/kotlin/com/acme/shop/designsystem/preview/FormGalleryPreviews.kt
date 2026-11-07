package com.acme.shop.designsystem.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.acme.shop.designsystem.components.button.AppPrimaryButton
import com.acme.shop.designsystem.components.form.AppKeyboards
import com.acme.shop.designsystem.components.form.AppPhoneField
import com.acme.shop.designsystem.components.form.CountryUi
import com.acme.shop.designsystem.components.textfield.AppDropdownField
import com.acme.shop.designsystem.components.textfield.AppOtpInput
import com.acme.shop.designsystem.components.textfield.AppTextField
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.AppWindowSize

private val SampleCountry = CountryUi("XA", "بلد أ", "+991", null, "^7[789][0-9]{7}$")
private const val OTP_LENGTH_PREVIEW = 6

/** The PRD forms (Login, Register, OTP) built from the kit: every field state next to each other. */
@Composable
private fun FormGallery() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppTheme.colors.background)
            .verticalScroll(rememberScrollState())
            .padding(AppTheme.adaptive.horizontalPadding),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space16),
    ) {
        AppPhoneField(
            value = "",
            onValueChange = {},
            country = SampleCountry,
            onCountryClick = {},
            label = "رقم الهاتف",
            placeholder = "7XXXXXXXX",
        )
        AppPhoneField(value = "791234567", onValueChange = {}, country = SampleCountry, onCountryClick = {}, label = "رقم الهاتف")
        AppPhoneField(
            value = "12",
            onValueChange = {},
            country = SampleCountry,
            onCountryClick = {},
            label = "رقم الهاتف",
            error = "رقم الهاتف غير صالح",
        )
        AppTextField(
            value = "",
            onValueChange = {},
            label = "البريد الإلكتروني",
            placeholder = "name@example.com",
            keyboardOptions = AppKeyboards.email,
        )
        AppTextField(value = "سارة", onValueChange = {}, label = "الاسم الأول", keyboardOptions = AppKeyboards.name)
        AppDropdownField(
            options = listOf("الشمال", "الشرق"),
            selectedIndex = null,
            onSelect = {},
            placeholder = "اختر المدينة",
            label = "المدينة",
        )
        AppDropdownField(
            options = emptyList(),
            selectedIndex = null,
            onSelect = {},
            placeholder = "اختر المنطقة",
            label = "المنطقة",
            enabled = false,
        )
        AppOtpInput(value = "12", onValueChange = {}, length = OTP_LENGTH_PREVIEW)
        AppOtpInput(value = "123456", onValueChange = {}, length = OTP_LENGTH_PREVIEW, error = true)
        AppPrimaryButton(text = "تسجيل الدخول", onClick = {}, enabled = false, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun FormPreviewFrame(dark: Boolean, rtl: Boolean, width: Int, height: Int) {
    val direction = if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides direction) {
        AppTheme(darkTheme = dark, windowSize = AppWindowSize(width.dp, height.dp)) { FormGallery() }
    }
}

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun FormPhonePortraitLightRtlPreview() = FormPreviewFrame(dark = false, rtl = true, width = 390, height = 844)

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun FormPhonePortraitDarkLtrPreview() = FormPreviewFrame(dark = true, rtl = false, width = 390, height = 844)

@Preview(widthDp = 844, heightDp = 390)
@Composable
private fun FormPhoneLandscapeLightRtlPreview() = FormPreviewFrame(dark = false, rtl = true, width = 844, height = 390)

@Preview(widthDp = 1024, heightDp = 768)
@Composable
private fun FormTabletLandscapeDarkRtlPreview() = FormPreviewFrame(dark = true, rtl = true, width = 1024, height = 768)
