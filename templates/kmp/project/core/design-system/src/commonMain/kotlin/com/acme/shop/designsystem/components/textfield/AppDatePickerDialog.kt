package com.acme.shop.designsystem.components.textfield

import com.acme.shop.designsystem.resources.date_picker_title
import com.acme.shop.designsystem.resources.date_picker_none
import com.acme.shop.designsystem.components.text.AppText
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.acme.shop.designsystem.components.button.AppTextButton
import com.acme.shop.designsystem.resources.Res
import com.acme.shop.designsystem.resources.date_picker_cancel
import com.acme.shop.designsystem.resources.date_picker_ok
import com.acme.shop.designsystem.theme.AppTheme
import org.jetbrains.compose.resources.stringResource

/**
 * Calendar picker for every date field: opens on [initialIsoDate] (or today), returns the chosen day as `yyyy-MM-dd`.
 * Colours come from the theme, so it follows light/dark; the platform locale gives RTL and month names.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppDatePickerDialog(
    initialIsoDate: String,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    val state = rememberDatePickerState(initialSelectedDateMillis = DatePickerDates.isoToMillis(initialIsoDate))
    val pickerColors = DatePickerDefaults.colors(
        containerColor = colors.card,
        titleContentColor = colors.muted,
        headlineContentColor = colors.ink,
        weekdayContentColor = colors.muted,
        dayContentColor = colors.ink,
        selectedDayContainerColor = colors.gradientStart,
        selectedDayContentColor = colors.onGradient,
        todayContentColor = colors.accent,
        todayDateBorderColor = colors.accent,
        selectedYearContainerColor = colors.gradientStart,
        selectedYearContentColor = colors.onGradient,
        navigationContentColor = colors.ink,
    )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        modifier = modifier,
        confirmButton = {
            AppTextButton(
                text = stringResource(Res.string.date_picker_ok),
                onClick = { state.selectedDateMillis?.let { onConfirm(DatePickerDates.millisToIso(it)) } ?: onDismiss() },
            )
        },
        dismissButton = { AppTextButton(text = stringResource(Res.string.date_picker_cancel), onClick = onDismiss) },
        colors = pickerColors,
    ) {
        // Calendar only: no switch to a typed date (owner request); title and headline from our AR/EN strings.
        DatePicker(
            state = state,
            colors = pickerColors,
            showModeToggle = false,
            title = {
                AppText(
                    text = stringResource(Res.string.date_picker_title),
                    style = AppTheme.typography.labelLarge,
                    color = colors.muted,
                    modifier = Modifier.padding(
                        start = AppTheme.spacing.space24,
                        end = AppTheme.spacing.space12,
                        top = AppTheme.spacing.space16,
                    ),
                )
            },
            headline = {
                val selected = state.selectedDateMillis?.let { DatePickerDates.display(DatePickerDates.millisToIso(it)) }
                AppText(
                    text = selected ?: stringResource(Res.string.date_picker_none),
                    style = AppTheme.typography.headlineSmall,
                    color = colors.ink,
                    modifier = Modifier.padding(
                        start = AppTheme.spacing.space24,
                        end = AppTheme.spacing.space12,
                        bottom = AppTheme.spacing.space12,
                    ),
                )
            },
        )
    }
}
