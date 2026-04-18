import pytest


def test_sanity():
    assert 1 + 1 == 2


@pytest.mark.asyncio
async def test_async_sanity():
    assert True
