# Marketplace manual test flow

1. Create product
    1. GET `http://localhost:8081/streamr-core/api/v1/categories`
    1. POST `http://localhost:8081/streamr-core/api/v1/products`
        * with body
        ```
        {
            "beneficiaryAddress": "0x3f2da479b77cb583c3462577dcd2e89b965fe987",
            "description": "Manual test run product from Postman!",
            "name": "Test",
            "ownerAddress": "0x3f2da479b77cb583c3462577dcd2e89b965fe987",
            "pricePerSecond": 1,
            "category": "1"
        }
        ```
        Response
        ```
        {
          "id": "14c45d3d4a8d466d8ee2f6d0302154e173c795e72e8f4ead87d9536573efe944",
          "name": "Test",
          "description": "Manual test run product from Postman!",
          "imageUrl": null,
          "category": "1",
          "streams": [],
          "state": "NOT_DEPLOYED",
          "previewStream": null,
          "previewConfigJson": null,
          "created": "2018-03-13T10:20:06Z",
          "updated": "2018-03-13T10:20:06Z",
          "ownerAddress": "0x3f2da479b77cb583c3462577dcd2e89b965fe987",
          "beneficiaryAddress": "0x3f2da479b77cb583c3462577dcd2e89b965fe987",
          "pricePerSecond": 1,
          "priceCurrency": "DATA",
          "minimumSubscriptionInSeconds": 0
        }
        ```
        * check that DB row was created in table `product`
    1. POST `http://localhost:8081/streamr-core/api/v1/products/14c45d3d4a8d466d8ee2f6d0302154e173c795e72e8f4ead87d9536573efe944/setDeploying` with body `{}`
        * check in DB that `product.state` changed to DEPLOYING
    1. Set streams to product (could be done on POST /products)
        * POST `http://localhost:8081/streamr-core/api/v1/products/14c45d3d4a8d466d8ee2f6d0302154e173c795e72e8f4ead87d9536573efe944/streams/9mFElsr2QHi1-6mr_9h6Aw`
        * POST `http://localhost:8081/streamr-core/api/v1/products/14c45d3d4a8d466d8ee2f6d0302154e173c795e72e8f4ead87d9536573efe944/streams/mAw5VUkyQd-IcmFcSVDcIw`
        * check that DB row was created in table `product_streams`
    1. Marketplace.createProduct
        * Remix argument string: `[20,196,93,61,74,141,70,109,142,226,246,208,48,33,84,225,115,199,149,231,46,143,78,173,135,217,83,101,115,239,233,68],"test","0x3f2da479b77cb583c3462577dcd2e89b965fe987",1,0,0`
        * For retry, delete and redeploy with argument `[20,196,93,61,74,141,70,109,142,226,246,208,48,33,84,225,115,199,149,231,46,143,78,173,135,217,83,101,115,239,233,68]`
        * check in DB that `product.state` changed to DEPLOYED
1. Subscribe    
    1. Token.mint
        * `"0x3f2da479b77cb583c3462577dcd2e89b965fe987",1000000`
    1. Token.approve
        * `"0x1994925b5da03929f8f51cf3891aee199656ec72",100000`
    1. MarketPlace.buy
        * Remix: `[20,196,93,61,74,141,70,109,142,226,246,208,48,33,84,225,115,199,149,231,46,143,78,173,135,217,83,101,115,239,233,68],1000`
        * check that DB row was created in table `subscription`