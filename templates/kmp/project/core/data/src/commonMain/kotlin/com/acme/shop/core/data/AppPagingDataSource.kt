package com.acme.shop.core.data

import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.acme.shop.core.domain.AppError
import com.acme.shop.core.domain.AppResult
import org.koin.core.component.KoinComponent

abstract class AppPagingDataSource<T : Any, D : Any>(
    private val onError: ((AppError) -> String)? = null,
) : PagingSource<Int, T>(), KoinComponent {

    abstract suspend fun fetchPage(page: Int, pageSize: Int): AppResult<PageableDto<D>>

    abstract fun D.toDomain(): T

    override fun getRefreshKey(state: PagingState<Int, T>): Int? {
        return state.anchorPosition?.let { position ->
            val page = state.closestPageToPosition(position)
            page?.prevKey?.plus(1) ?: page?.nextKey?.minus(1)
        }
    }

    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, T> {
        return try {
            val page = params.key ?: 1
            val pageSize = params.loadSize

            when (val result = fetchPage(page, pageSize)) {
                is AppResult.Success -> {
                    val mappedData = result.data.data.map { it.toDomain() }
                    LoadResult.Page(
                        data = mappedData,
                        prevKey = if (page == 1) null else page - 1,
                        nextKey = if (!result.data.nextPageUrl.isNullOrBlank() && mappedData.isNotEmpty()) page + 1 else null,
                    )
                }

                is AppResult.Error -> {
                    val message = onError?.invoke(result.appError)
                        ?: when (val error = result.appError) {
                            is AppError.ServerError -> error.message ?: error.code.name
                            is AppError.HttpError -> error.message
                            is AppError.ParseError -> error.message
                            is AppError.NetworkError -> error.errorMsg
                            is AppError.UnknownError -> error.errorMsg
                        }
                        ?: "Unknown error"
                    LoadResult.Error(Exception(message))
                }

                is AppResult.Loading -> {
                    LoadResult.Error(Exception("Unexpected loading state"))
                }
            }
        } catch (e: Exception) {
            LoadResult.Error(e)
        }
    }
}
