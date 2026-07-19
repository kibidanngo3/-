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

    updateCartCount();

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

    if(document.getElementById("cartTableBody")){
    renderCart();
    }
    if(document.getElementById("priceTableBody")){
    loadPrices();
    }

    if(document.getElementById("analyticsTableBody")){
    loadAnalytics();
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

        // 「現在庫」はAI分析時点のスナップショットではなく、在庫管理の実データを使う
        const lowStock = products.filter(p => p.current_stock != null && p.current_stock <= 10);
        document.getElementById("lowStockCount").textContent = lowStock.length;

        const needPurchase = recommendations.filter(r => r.purchase_needed);
        document.getElementById("recommendCount").textContent = needPurchase.length;

        const total = needPurchase.reduce((sum, r) => sum + r.recommended_qty, 0);
        document.getElementById("recommendTotal").textContent = total;

        const needPurchaseWithNames = needPurchase.map(r => {
            const product = products.find(p => p.product_code === r.product_code);
            return {
                ...r,
                product_name: product ? product.product_name : "不明",
                current_stock: product ? product.current_stock : null
            };
        });

        createRecommendationTable(needPurchaseWithNames);

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
            <td>${item.product_name}</td>
            <td>${item.current_stock ?? "-"}</td>
            <td>${Number(item.predicted_consumption).toFixed(1)}</td>
            <td>${item.recommended_qty}</td>
            <td>${item.next_order_date ?? "-"}</td>
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
                onclick="changePrice(${product.product_code})">

                価格変更

                </button>

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

// ------------------------------
// 商品コード入力欄を商品名の選択式にする共通ヘルパー
// ------------------------------
function populateProductSelect(selectId, products){

    const select = document.getElementById(selectId);

    if(!select) return;

    const currentValue = select.value;

    select.innerHTML = `<option value="">商品を選択</option>`;

    products.forEach(product => {
        select.innerHTML += `
            <option value="${product.product_code}">
                ${product.product_name}
            </option>
        `;
    });

    if(currentValue){
        select.value = currentValue;
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


    // 価格チェック

    if(productData.price != null && productData.price < 0){

        alert("価格は0以上を入力してください");

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

window.deleteProduct = deleteProduct;

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

        populateProductSelect("stockProductCode", products);

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

                <td>${name}</td>

                <td>${stock.stock_count}</td>

                <td class="${statusClass}">
                    ${status}
                </td>

                <td>
                    <button class="action-btn"
                    onclick="editStock(${stock.product_code}, ${stock.stock_count})">
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
// 在庫更新（一覧の行から編集）
// ======================================

function editStock(productCode, currentCount){

    document.getElementById("stockProductCode").value = productCode;
    document.getElementById("stockCount").value = currentCount;

    document.getElementById("stockCount").focus();
    document.getElementById("stockCount").select();

}

window.editStock = editStock;

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

        const [purchaseRes, productRes] = await Promise.all([
            fetch(`${API_BASE}/api/purchases`),
            fetch(`${API_BASE}/api/products`)
        ]);


        const purchases = await purchaseRes.json();
        const products = await productRes.json();

        productList = products;

        populateProductSelect("purchaseProductCode", products);


        const tbody = document.getElementById(
            "purchaseTableBody"
        );


        if(!tbody) return;


        tbody.innerHTML = "";


        purchases.forEach(item => {

            const product = products.find(
                p => p.product_code === item.product_code
            );

            const name = product ? product.product_name : "不明";


            tbody.innerHTML += `

            <tr>

                <td>${item.purchase_id}</td>

                <td>${item.purchase_date}</td>

                <td>${name}</td>

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
// 発注カート（入荷する商品をいったんためておく）
// AI推奨からの一括追加と、ここでの手動追加を同じカートにまとめ、
// 「この内容で入荷する」を押した時点でまとめて発注登録＋在庫反映する
// ======================================

const CART_KEY = "kobaiCart";

function getCart(){
    try{
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    }catch(e){
        return [];
    }
}

function saveCart(cart){
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(item){
    const cart = getCart();
    cart.push(item);
    saveCart(cart);
    renderCart();
}

function removeFromCart(index){
    const cart = getCart();
    cart.splice(index, 1);
    saveCart(cart);
    renderCart();
}
window.removeFromCart = removeFromCart;

function updateCartCount(){
    const countEl = document.getElementById("cartCount");
    if(countEl) countEl.textContent = getCart().length;
}

function renderCart(){

    updateCartCount();

    const tbody = document.getElementById("cartTableBody");

    if(!tbody) return;

    const cart = getCart();

    if(cart.length === 0){
        tbody.innerHTML = `<tr><td colspan="4">カートは空です</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    cart.forEach((item, index) => {
        tbody.innerHTML += `
        <tr>
            <td>${item.product_name}</td>
            <td>${item.quantity}</td>
            <td>${item.amount != null ? item.amount + "円" : "-"}</td>
            <td>
                <button class="action-btn" onclick="removeFromCart(${index})">削除</button>
            </td>
        </tr>
        `;
    });

}
window.renderCart = renderCart;

// ------------------------------
// 手動でカートに追加
// ------------------------------
function addPurchaseToCart(){

    const select = document.getElementById("purchaseProductCode");
    const productCode = select.value;
    const productName = select.selectedOptions[0]
        ? select.selectedOptions[0].textContent.trim()
        : "";

    const quantity = Number(
        document.getElementById("purchaseQuantity").value
    );


    if(!productCode || !quantity){

        alert("商品と数量を入力してください");

        return;

    }

    // 過去の仕入実績（仕入金額 ÷ 仕入数量）の平均単価から金額を自動計算する
    const product = productList.find(
        p => p.product_code === Number(productCode)
    );
    const amount =
        product && product.avg_purchase_unit_cost != null
        ? Math.round(product.avg_purchase_unit_cost * quantity)
        : null;


    addToCart({
        product_code: Number(productCode),
        product_name: productName,
        quantity: quantity,
        amount: amount
    });


    // 入力欄クリア
    document.getElementById("purchaseProductCode").value = "";
    document.getElementById("purchaseQuantity").value = "";

}
window.addPurchaseToCart = addPurchaseToCart;

// ------------------------------
// カートの内容で入荷（発注登録＋在庫反映）を確定する
// ------------------------------
async function submitCart(){

    const cart = getCart();

    if(cart.length === 0){
        alert("カートが空です");
        return;
    }

    if(!confirmAction(`カート内の ${cart.length}件 を入荷登録します。よろしいですか？`)){
        return;
    }

    const today = new Date().toISOString().slice(0, 10);

    let successCount = 0;
    let failCount = 0;

    for(const item of cart){

        try{

            const res = await fetch(
                `${API_BASE}/api/purchases`,
                {
                    method:"POST",
                    headers:{
                        "Content-Type":"application/json"
                    },
                    body: JSON.stringify({
                        purchase_date: today,
                        product_code: item.product_code,
                        quantity: item.quantity,
                        amount: item.amount ?? null
                    })
                }
            );

            if(res.status === 201){
                successCount++;
            }else{
                failCount++;
            }

        }catch(e){
            console.error(e);
            failCount++;
        }

    }

    alert(`入荷登録が完了しました（成功 ${successCount}件 / 失敗 ${failCount}件）。在庫にも反映されています。`);

    saveCart([]);
    renderCart();
    loadPurchases();

}
window.submitCart = submitCart;

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

                <td>${item.product_name}</td>

                <td>
                    ${item.genre_name ?? "-"}
                </td>

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

    if(Number.isNaN(Number(price)) || Number(price) < 0){
        alert("価格は0以上の数値を入力してください");
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
            loadProducts();

        }else{

            const error = await res.json();

            alert(error.error ?? "価格変更失敗");

        }


    }catch(e){

        console.error(e);

        alert("価格変更エラー");

    }

}

// ======================================
// AI分析ページ
// ======================================

let currentNeedBuy = [];

async function loadAnalytics(){

    try{

        const [recommendRes, productRes] = await Promise.all([
            fetch(`${API_BASE}/api/recommendations`),
            fetch(`${API_BASE}/api/products`)
        ]);

        const recommendations = await recommendRes.json();
        const products = await productRes.json();

        const needBuy = recommendations
            .filter(r => r.purchase_needed)
            .sort((a,b) => b.recommended_qty - a.recommended_qty)
            .map(r => {
                const product = products.find(p => p.product_code === r.product_code);
                return {
                    ...r,
                    product_name: product ? product.product_name : "不明",
                    // カートの金額計算用（過去の仕入実績の平均単価）
                    avg_purchase_unit_cost: product ? product.avg_purchase_unit_cost : null,
                    // 「現在庫」はAI分析時点のスナップショットではなく、在庫管理の実データを使う
                    current_stock: product ? product.current_stock : null
                };
            });

        currentNeedBuy = needBuy;

        document.getElementById("analyticsNeedCount").textContent = needBuy.length;

        const total = needBuy.reduce((sum, r) => sum + r.recommended_qty, 0);
        document.getElementById("analyticsTotalQty").textContent = total;

        const note = document.getElementById("analyticsNote");
        if(recommendations.length === 0){
            note.textContent = "まだAIの算出結果がありません";
        }else{
            const generatedAt = new Date(recommendations[0].generated_at).toLocaleString("ja-JP");
            note.textContent = `算出日時: ${generatedAt}`;
        }

        const tbody = document.getElementById("analyticsTableBody");

        if(needBuy.length === 0){
            tbody.innerHTML = `<tr><td colspan="7">現時点で発注が必要な商品はありません</td></tr>`;
            return;
        }

        tbody.innerHTML = "";

        needBuy.forEach(item => {

            const statusClass = item.purchase_needed ? "low-stock" : "good-stock";
            const statusLabel = item.purchase_needed ? "要発注" : "在庫充足";

            tbody.innerHTML += `
            <tr>
                <td>${item.product_name}</td>
                <td>${item.current_stock ?? "-"}</td>
                <td>${item.last_cycle_consumption ?? "-"}</td>
                <td>${Number(item.predicted_consumption).toFixed(1)}</td>
                <td>${item.recommended_qty}</td>
                <td>${item.next_order_date ?? "-"}</td>
                <td class="${statusClass}">${statusLabel}</td>
            </tr>
            `;

        });

    }catch(e){

        console.error(e);

        alert("AI分析データの取得に失敗しました");

    }

}

window.loadAnalytics = loadAnalytics;

// ======================================
// AI推奨商品をまとめてカートに追加
// ======================================

function addRecommendationsToCart(){

    if(currentNeedBuy.length === 0){
        alert("現時点で発注が必要な商品はありません");
        return;
    }

    if(!confirmAction(`AI推奨の ${currentNeedBuy.length}件 をカートに追加します。よろしいですか？`)){
        return;
    }

    const cart = getCart();

    currentNeedBuy.forEach(item => {
        cart.push({
            product_code: item.product_code,
            product_name: item.product_name,
            quantity: item.recommended_qty,
            amount: item.avg_purchase_unit_cost != null ? Math.round(item.avg_purchase_unit_cost * item.recommended_qty) : null
        });
    });

    saveCart(cart);

    alert(`${currentNeedBuy.length}件をカートに追加しました。カートページで内容を確認し、「入荷する」を押してください。`);

}

window.addRecommendationsToCart = addRecommendationsToCart;


window.changePrice = changePrice;