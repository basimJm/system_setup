package com.acme.shop.designsystem.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import com.acme.shop.designsystem.components.badge.AppCountBadge
import com.acme.shop.designsystem.components.badge.AppStatusBadge
import com.acme.shop.designsystem.components.badge.StatusTone
import com.acme.shop.designsystem.components.button.AppOutlinedButton
import com.acme.shop.designsystem.components.button.AppPrimaryButton
import com.acme.shop.designsystem.components.button.AppSecondaryButton
import com.acme.shop.designsystem.components.card.AppCard
import com.acme.shop.designsystem.components.chip.AppFilterChip
import com.acme.shop.designsystem.components.chip.AppTimeSlotChip
import com.acme.shop.designsystem.components.chip.SlotState
import com.acme.shop.designsystem.components.feedback.AppOfflineState
import com.acme.shop.designsystem.components.rating.AppRatingStars
import com.acme.shop.designsystem.components.section.AppSectionHeader
import com.acme.shop.designsystem.components.selector.AppSegmentedTabs
import com.acme.shop.designsystem.components.stepper.AppStepIndicator
import com.acme.shop.designsystem.components.text.AppText
import com.acme.shop.designsystem.components.textfield.AppOtpInput
import com.acme.shop.designsystem.components.textfield.AppSearchBar
import com.acme.shop.designsystem.components.textfield.AppTextField
import com.acme.shop.designsystem.theme.AppTheme
import com.acme.shop.designsystem.theme.AppWindowSize

@Composable
private fun Gallery() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppTheme.colors.background)
            .verticalScroll(rememberScrollState())
            .padding(AppTheme.adaptive.horizontalPadding),
        verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space16),
    ) {
        AppSectionHeader(title = "الصالونات", actionText = "عرض الكل", onAction = {})
        AppSegmentedTabs(tabs = listOf("رجال", "نساء"), selectedIndex = 1, onSelect = {})
        AppSearchBar(value = "", onValueChange = {}, placeholder = "ابحث عن اسم الصالون", filterDescription = "فلتر", onFilterClick = {})
        Row(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8)) {
            AppFilterChip(text = "الأقرب", selected = true, onClick = {}, onRemove = {})
            AppFilterChip(text = "الموصى بها", selected = false, onClick = {})
        }
        AppCard(modifier = Modifier.fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8)) {
                AppText(text = "صالون لمسة جمال", style = AppTheme.typography.titleMedium)
                AppRatingStars(rating = 4.5f)
                Row(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8)) {
                    AppStatusBadge(text = "مفتوح", tone = StatusTone.Success)
                    AppStatusBadge(text = "قيد الانتظار", tone = StatusTone.Warning)
                    AppStatusBadge(text = "مرفوض", tone = StatusTone.Danger)
                    AppCountBadge(count = 120)
                }
            }
        }
        AppTextField(value = "", onValueChange = {}, label = "الاسم الأول", placeholder = "أدخل اسمك")
        AppTextField(value = "x", onValueChange = {}, label = "البريد الإلكتروني", error = "بريد غير صالح")
        AppOtpInput(value = "123", onValueChange = {}, length = 6)
        AppStepIndicator(currentStep = 2, stepCount = 6)
        Row(horizontalArrangement = Arrangement.spacedBy(AppTheme.spacing.space8)) {
            AppTimeSlotChip(time = "10:00 ص", state = SlotState.Available, onClick = {})
            AppTimeSlotChip(time = "10:15 ص", state = SlotState.Selected, onClick = {})
            AppTimeSlotChip(time = "10:30 ص", state = SlotState.Full, onClick = {}, fullLabel = "ممتلئ")
        }
        AppPrimaryButton(text = "احجز الآن", onClick = {}, modifier = Modifier.fillMaxWidth())
        AppSecondaryButton(text = "عرض الحجز", onClick = {}, modifier = Modifier.fillMaxWidth())
        AppOutlinedButton(text = "إلغاء", onClick = {}, modifier = Modifier.fillMaxWidth())
        AppOfflineState(onRetry = {})
    }
}

@Composable
private fun PreviewFrame(dark: Boolean, rtl: Boolean, width: Int, height: Int) {
    val direction = if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    CompositionLocalProvider(LocalLayoutDirection provides direction) {
        AppTheme(darkTheme = dark, windowSize = AppWindowSize(width.dp, height.dp)) { Gallery() }
    }
}

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun GalleryPhonePortraitLightRtlPreview() = PreviewFrame(dark = false, rtl = true, width = 390, height = 844)

@Preview(widthDp = 390, heightDp = 844)
@Composable
private fun GalleryPhonePortraitDarkLtrPreview() = PreviewFrame(dark = true, rtl = false, width = 390, height = 844)

@Preview(widthDp = 844, heightDp = 390)
@Composable
private fun GalleryPhoneLandscapeLightRtlPreview() = PreviewFrame(dark = false, rtl = true, width = 844, height = 390)

@Preview(widthDp = 1024, heightDp = 768)
@Composable
private fun GalleryTabletLandscapeDarkRtlPreview() = PreviewFrame(dark = true, rtl = true, width = 1024, height = 768)
