// ======================================
// 研究室購買部 管理システム
// 共通JavaScript
// ======================================

const API_BASE = "https://1acuynf6vk.execute-api.us-east-1.amazonaws.com";

// ページ読み込み時
document.addEventListener("DOMContentLoaded", () => {

    console.log("管理システム起動");

    highlightCurrentPage();


    const updateBtn = document.getElementById("updateStockBtn");

    if(updateBtn){

        updateBtn.addEventListener(
            "click",
            updateStock
        );

    }

});

// ------------------------------
// 現在開いているページのボタン色変更
// ------------------------------
function highlightCurrentPage() {
    const currentPage = window.location.pathname.split("/").pop();

    document.querySelectorAll(".menu a").forEach(link => {
        const href = link.getAttribute("href");

        if (href === currentPage) {
            const button = link.querySelector("button");
            if (button) {
                button.style.backgroundColor = "#0056b3";
            }
        }
    });
}

// ------------------------------
// 確認ダイアログ
// ------------------------------
function confirmAction(message) {
    return confirm(message);
}

// ------------------------------
// 通知表示
// ------------------------------
function showMessage(message) {
    alert(message);
}

window.addEventListener("DOMContentLoaded", () => {

    if(document.getElementById("productCount")){
        loadDashboard();
    }

    if(document.getElementById("productTable")){
        loadProducts();
    }

    if(document.getElementById("genreSelect")){
        loadGenres();
    }

    if(document.getElementById("inventoryTableBody")){
    loadInventory();
    }
    if(document.getElementById("purchaseTableBody")){
    loadPurchases();
    }
    if(document.getElementById("priceTableBody")){
    loadPrices();
    }

});

async function loadDashboard() {

    try {

        const [productRes, recommendRes] = await Promise.all([
            fetch(`${API_BASE}/api/products`),
            fetch(`${API_BASE}/api/recommendations`)
        ]);

        const products = await productRes.json();
        const recommendations = await recommendRes.json();

        document.getElementById("productCount").textContent = products.length;

        const lowStock = recommendations.filter(r => r.current_stock <= 10);
        document.getElementById("lowStockCount").textContent = lowStock.length;

        const needPurchase = recommendations.filter(r => r.purchase_needed);
        document.getElementById("recommendCount").textContent = needPurchase.length;

        const total = needPurchase.reduce((sum, r) => sum + r.recommended_qty, 0);
        document.getElementById("recommendTotal").textContent = total;

        createRecommendationTable(needPurchase);

    } catch (e) {
        console.error(e);
        alert("APIの取得に失敗しました");
    }

}

function createRecommendationTable(data) {

    const tbody = document.querySelector("#recommendTable tbody");

    tbody.innerHTML = "";

    data.forEach(item => {

        tbody.innerHTML += `
        <tr>
            <td>${item.product_code}</td>
            <td>${item.current_stock}</td>
            <td>${Number(item.predicted_consumption).toFixed(1)}</td>
            <td>${item.recommended_qty}</td>
        </tr>
        `;

    });

}

// ======================================
// 商品一覧データ
// ======================================

let productList = [];



// ======================================
// 商品一覧取得
// ======================================

async function loadProducts(){

    try{

        const res = await fetch(
            `${API_BASE}/api/products`
        );


        productList = await res.json();


        const tbody = document.querySelector(
            "#productTable tbody"
        );


        // products.html以外では実行しない
        if(!tbody) return;


        displayProducts(productList);



    }catch(e){

        console.error(e);

        alert(
            "商品一覧の取得に失敗しました"
        );

    }

}





// ======================================
// 商品表示
// ======================================

function displayProducts(products){


    const tbody = document.querySelector(
        "#productTable tbody"
    );


    if(!tbody) return;


    tbody.innerHTML = "";



    products.forEach(product => {


        tbody.innerHTML += `

        <tr>


            <td>
                ${product.product_code}
            </td>


            <td>
                ${product.product_name}
            </td>


            <td>
                ${product.genre_name ?? ""}
            </td>


            <td>
                ${product.current_price ?? "-"}円
            </td>


            <td>
                ${product.current_stock ?? "-"}
            </td>


            <td>

                <button 
                class="action-btn"
                onclick="deleteProduct(${product.product_code})">

                削除

                </button>

            </td>


        </tr>

        `;


    });


}

// ======================================
// 商品名検索
// ======================================

document
.getElementById("productSearch")
?.addEventListener(
"input",
function(){


    const keyword =
    this.value;



    const result =
    productList.filter(product =>


        product.product_name
        .includes(keyword)


    );


    displayProducts(result);


});







// ======================================
// 商品ソート
// ======================================

document
.getElementById("sortSelect")
?.addEventListener(
"change",
function(){


    let result =
    [...productList];



    switch(this.value){


        // 価格が安い順
        case "priceAsc":

            result.sort(
                (a,b)=>
                a.current_price -
                b.current_price
            );

            break;



        // 価格が高い順
        case "priceDesc":

            result.sort(
                (a,b)=>
                b.current_price -
                a.current_price
            );

            break;




        // 在庫が少ない順
        case "stockAsc":

            result.sort(
                (a,b)=>
                a.current_stock -
                b.current_stock
            );

            break;




        // 在庫が多い順
        case "stockDesc":

            result.sort(
                (a,b)=>
                b.current_stock -
                a.current_stock
            );

            break;


    }



    displayProducts(result);


});

// ======================================
// ジャンル一覧取得
// ======================================

async function loadGenres(){

    try{

        const res = await fetch(`${API_BASE}/api/genres`);

        const genres = await res.json();

        const select = document.getElementById("genreSelect");

        // product.html以外では実行しない
        if(!select) return;


        genres.forEach(genre => {

            select.innerHTML += `
                <option value="${genre.genre_id}">
                    ${genre.genre_name}
                </option>
            `;

        });


    }catch(e){

        console.error(e);
        alert("ジャンル取得に失敗しました");

    }

}

// ======================================
// 商品追加
// ======================================

async function addProduct(){


    const productData = {


        product_name:
            document.getElementById("productName").value,


        genre_id:
            Number(
                document.getElementById("genreSelect").value
            ),


        temp_zone:
            document.getElementById("tempZone").value,


        container:
            document.getElementById("container").value,



        volume_ml:
            document.getElementById("volume").value
            ? Number(
                document.getElementById("volume").value
              )
            : null,



        price:
            document.getElementById("price").value
            ? Number(
                document.getElementById("price").value
              )
            : null


    };




    // 商品名チェック

    if(!productData.product_name){

        alert("商品名を入力してください");

        return;

    }




    // ジャンルチェック

    if(!productData.genre_id){

        alert("ジャンルを選択してください");

        return;

    }




    try{


        const res = await fetch(
            `${API_BASE}/api/products`,
            {

                method:"POST",

                headers:{

                    "Content-Type":"application/json"

                },


                body:
                    JSON.stringify(productData)

            }
        );




        if(res.status === 201){


            alert("商品を登録しました");



            // 入力欄リセット

            document.getElementById("productName").value="";


            document.getElementById("genreSelect").value="";


            document.getElementById("tempZone").value="";


            document.getElementById("container").value="";


            document.getElementById("volume").value="";


            document.getElementById("price").value="";




            // 商品一覧更新

            loadProducts();



        }else{


            const error = await res.json();


            alert(
                error.error ?? 
                "商品登録に失敗しました"
            );


        }




    }catch(e){


        console.error(e);


        alert(
            "商品登録エラー"
        );


    }


}




window.addProduct = addProduct;

// ======================================
// 商品削除
// ======================================

async function deleteProduct(productCode){

    if(!confirm("この商品を削除しますか？")){
        return;
    }


    try{

        const res = await fetch(
            `${API_BASE}/api/products/${productCode}`,
            {
                method:"DELETE"
            }
        );


        if(res.status === 204){

            alert("削除しました");

            // 一覧更新
            loadProducts();

        }else{

            const error = await res.json();

            alert(error.error ?? "削除に失敗しました");

        }


    }catch(e){

        console.error(e);

        alert("削除処理に失敗しました");

    }

}

// ======================================
// 在庫一覧取得
// ======================================

async function loadInventory(){

    try{

        const [stockRes, productRes] = await Promise.all([
            fetch(`${API_BASE}/api/stock-records/current`),
            fetch(`${API_BASE}/api/products`)
        ]);


        const stocks = await stockRes.json();
        const products = await productRes.json();


        const tbody = document.getElementById("inventoryTableBody");

        if(!tbody) return;


        tbody.innerHTML = "";


        stocks.forEach(stock => {


            const product = products.find(
                p => p.product_code === stock.product_code
            );


            const name = product ?
                product.product_name :
                "不明";


            const status =
                stock.stock_count <= 10
                ? "不足"
                : "十分";


            const statusClass =
                stock.stock_count <= 10
                ? "low-stock"
                : "good-stock";


            tbody.innerHTML += `

            <tr>

                <td>${stock.product_code}</td>

                <td>${name}</td>

                <td>${stock.stock_count}</td>

                <td class="${statusClass}">
                    ${status}
                </td>

                <td>
                    <button class="action-btn"
                    onclick="showMessage('在庫更新機能')">
                    在庫更新
                    </button>
                </td>

            </tr>

            `;

        });


    }catch(e){

        console.error(e);

        alert("在庫取得に失敗しました");

    }

}

// ======================================
// 在庫更新
// ======================================

async function updateStock(){

    const productCode = Number(
        document.getElementById("stockProductCode").value
    );

    const stockCount = Number(
        document.getElementById("stockCount").value
    );


    if(!productCode || stockCount < 0){

        alert("商品コードと在庫数を入力してください");

        return;

    }


    const data = {

        record_date: new Date()
            .toISOString()
            .slice(0,10),

        product_code: productCode,

        stock_count: stockCount

    };


    try{

        const res = await fetch(
            `${API_BASE}/api/stock-records`,
            {
                method:"POST",

                headers:{
                    "Content-Type":"application/json"
                },

                body:JSON.stringify(data)
            }
        );


        if(res.status === 201){

            alert("在庫を更新しました");

            // 入力欄クリア
            document.getElementById("stockProductCode").value="";
            document.getElementById("stockCount").value="";


            // 一覧更新
            loadInventory();


        }else{

            const error = await res.json();

            alert(error.error ?? "在庫更新に失敗しました");

        }


    }catch(e){

        console.error(e);

        alert("在庫更新エラー");

    }

}


window.updateStock = updateStock;

// ======================================
// 発注履歴取得
// ======================================

async function loadPurchases(){

    try{

        const res = await fetch(
            `${API_BASE}/api/purchases`
        );


        const purchases = await res.json();


        const tbody = document.getElementById(
            "purchaseTableBody"
        );


        if(!tbody) return;


        tbody.innerHTML = "";


        purchases.forEach(item => {


            tbody.innerHTML += `

            <tr>

                <td>${item.purchase_id}</td>

                <td>${item.purchase_date}</td>

                <td>${item.product_code}</td>

                <td>${item.quantity}</td>

                <td>${item.amount ?? "-"}</td>

            </tr>

            `;

        });


    }catch(e){

        console.error(e);

        alert("発注履歴取得失敗");

    }

}

window.loadPurchases = loadPurchases;
console.log("ここまで読み込みOK");

// ======================================
// 発注登録
// ======================================

async function addPurchase(){

    const data = {

        purchase_date:
            document.getElementById("purchaseDate").value,

        product_code:
            Number(
                document.getElementById("purchaseProductCode").value
            ),

        quantity:
            Number(
                document.getElementById("purchaseQuantity").value
            ),

        amount:
            Number(
                document.getElementById("purchaseAmount").value
            )

    };


    if(!data.purchase_date || !data.product_code || !data.quantity){

        alert("日付・商品コード・数量を入力してください");

        return;

    }


    try{

        const res = await fetch(
            `${API_BASE}/api/purchases`,
            {

                method:"POST",

                headers:{
                    "Content-Type":"application/json"
                },

                body:JSON.stringify(data)

            }
        );


        if(res.status === 201){

            alert("発注を登録しました");


            // 入力欄クリア

            document.getElementById("purchaseDate").value="";
            document.getElementById("purchaseProductCode").value="";
            document.getElementById("purchaseQuantity").value="";
            document.getElementById("purchaseAmount").value="";


            // 一覧更新

            loadPurchases();


        }else{

            const error = await res.json();

            alert(error.error ?? "発注登録に失敗しました");

        }


    }catch(e){

        console.error(e);

        alert("発注登録エラー");

    }

}

window.addPurchase = addPurchase;

// ======================================
// 価格一覧取得
// ======================================

async function loadPrices(){

    try{

        const res = await fetch(
            `${API_BASE}/api/products`
        );

        const products = await res.json();
        console.log(products);


        const tbody = document.getElementById(
            "priceTableBody"
        );


        if(!tbody) return;


        tbody.innerHTML = "";


        products.forEach(item => {


            tbody.innerHTML += `

            <tr>

                <td>${item.product_code}</td>

                <td>${item.product_name}</td>

                <td>
                    ${item.current_price ?? "-"}円
                </td>

                <td>
                    ${item.price_effective_date ?? "-"}
                </td>

                <td>

                    <button class="action-btn"
                    onclick="changePrice(${item.product_code})">

                    価格変更

                    </button>

                </td>

            </tr>

            `;


        });


    }catch(e){

        console.error(e);

        alert("価格一覧取得失敗");

    }

}


window.loadPrices = loadPrices;

// ======================================
// 価格変更
// ======================================

async function changePrice(productCode){

    const price = prompt(
        "新しい価格を入力してください"
    );


    if(!price){
        return;
    }


    const data = {

        product_code: productCode,

        effective_date:
            new Date()
            .toISOString()
            .slice(0,10),

        price: Number(price)

    };


    try{

        const res = await fetch(
            `${API_BASE}/api/price-revisions`,
            {
                method:"POST",

                headers:{
                    "Content-Type":"application/json"
                },

                body:JSON.stringify(data)
            }
        );


        if(res.status === 201){

            alert("価格を変更しました");

            loadPrices();

        }else{

            const error = await res.json();

            alert(error.error ?? "価格変更失敗");

        }


    }catch(e){

        console.error(e);

        alert("価格変更エラー");

    }

}


window.changePrice = changePrice;