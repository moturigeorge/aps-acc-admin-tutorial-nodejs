const TABLE_TABS = {
    'PROJECTS': {
        'REQUEST_URL': '/api/admin/projects',
        'TAB_NAME': 'PROJECTS',
        'CATEGORY_NAME': 'hub',
        'CATEGORY_DEFAULT': true
    },
    'PROJECT': {
        'REQUEST_URL': '/api/admin/project',
        'TAB_NAME': 'PROJECT',
        'CATEGORY_NAME': 'project',
        'CATEGORY_DEFAULT': true
    },
    'USERS': {
        'REQUEST_URL': '/api/admin/project/users',
        'TAB_NAME': 'USERS',
        'CATEGORY_NAME': 'project',
        'CATEGORY_DEFAULT': false
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//Table class wraps the specific data info
class Table {
    #tableId;
    #accountId;
    #projectId;
    #tabKey;
    #dataSet;

    constructor(tableId, accountId = null, projectId = null, tabKey = 'PROJECTS') {
        this.#tableId = tableId;
        this.#accountId = accountId;
        this.#projectId = projectId;
        this.#tabKey = tabKey;
        this.#dataSet = null;
    };

    get tabKey(){
        return this.#tabKey;
    }

    resetDataInfo( tabKey=null, accountId=null, projectId=null ){
        this.#tabKey = tabKey? tabKey: this.#tabKey;
        this.#accountId = accountId? accountId: this.#accountId;
        this.#projectId = accountId||projectId? projectId: this.#projectId;
        this.#dataSet = null;
    }

    async prepareDataAndDraw(){
        const url = TABLE_TABS[this.#tabKey].REQUEST_URL;
        const data = {
            'accountId': this.#accountId,
            'projectId': this.#projectId
        }
        try {
            const response = await axios.get(url, { params: data } );
            this.#dataSet = response.data;
        } catch (err) {
            console.error(err);
            return;
        }
        // Mark "N/A" for complicated properties.
        for (var key in this.#dataSet[0]) {
            if (Array.isArray(this.#dataSet[0][key]) || typeof this.#dataSet[0][key] === 'object' && this.#dataSet[0][key] != null) {
                this.#dataSet.forEach(item => {
                    item[key] = "N/A";
                })
            }
        }
        let columns = [];
        for (var key in this.#dataSet[0]) {
            columns.push({
                field: key,
                title: key,
                align: "center"
            })
        }
        $(this.#tableId).bootstrapTable('destroy');
        $(this.#tableId).bootstrapTable({
            data: this.#dataSet,
            customToolbarButtons: [
                {
                    name: "grid-export",
                    title: "Export",
                    icon: "glyphicon-export",
                    callback: exportData
                },
                {
                    name: "grid-import",
                    title: "Import",
                    icon: "glyphicon-import",
                    callback: importData
                }
            ],
            editable: true,
            clickToSelect: true,
            cache: false,
            showToggle: false,
            pagination: true,
            pageList: [5,10],
            pageSize: 5,
            pageNumber: 1,
            uniqueId: 'id',
            striped: true,
            search: true,
            showRefresh: true,
            minimumCountColumns: 2,
            smartDisplay: true,
            columns: columns
        });
    }

    exportToCSV() {
        if (this.#dataSet == null || this.#dataSet.length == 0) {
            console.warn('DataSet is not ready, please fetch your data first.');
            return;
        }
        let csvDataList = [];
        let csvHeader = [];
        for (let key in this.#dataSet[0]) {
            csvHeader.push(key);
        }
        csvDataList.push(csvHeader);
        this.#dataSet.forEach((row) => {
            let csvRowItem = [];
            for (let key in row) {
                if (typeof row[key] === 'string')
                    csvRowItem.push("\"" + row[key].replace(/\"/g, "\"\"").replace("#", "") + "\"")
                else
                    csvRowItem.push(row[key]);
            }
            csvDataList.push(csvRowItem);
        })
        let csvString = csvDataList.join("%0A");
        let a = document.createElement('a');
        a.href = 'data:attachment/csv,' + csvString;
        a.target = '_blank';
        a.download = this.#tabKey + (new Date()).getTime() + '.csv';
        document.body.appendChild(a);
        a.click();
    }

    async importFromCSV( inputCSVData ){
        if( inputCSVData == null ){
            console.warn('The input csv file is not ready, please provide correct csv data.');
            return;
        }
        const rows = inputCSVData.split("\r\n");
        const keys = rows[0].split(',');
        let requestDataList = [];
        for (let i = 1; i < rows.length; i++) {
            let jsonDataItem = {};
            let cells = rows[i].split(",");
            for (let j = 0; j < cells.length; j++) {
                if (cells[j] == null || cells[j] == '')
                    continue
                // customize the input property
                let key = keys[j];
                switch (this.#tabKey) {
                    case 'PROJECTS':
                        if (key == 'template') {
                            jsonDataItem[key] = { 'projectId': cells[j] };
                            continue;
                        }
                        break;
                    case 'PROJECT':
                    case 'USERS':
                        if(key == 'roleIds'){
                            const roleIdList = cells[j].replace(/\s/g,'').split('|');
                            jsonDataItem[key] = roleIdList;
                            continue;
                        }
                        const params = key.split('.')
                        const length = params.length;
                        if (length == 2 && params[0] == 'products') {
                            let productAccess = {
                                "key": params[length - 1],
                                "access": cells[j]
                            }
                            if (jsonDataItem["products"] == null) {
                                jsonDataItem["products"] = [];
                            }
                            jsonDataItem["products"].push(productAccess)
                            continue
                        }
                        break;
                    default:
                        console.warn("The current Admin Data Type is not expected");
                        break;
                }
                jsonDataItem[key] = cells[j];
            }
            requestDataList.push(jsonDataItem);
        }
        const data = {
            'accountId': this.#accountId,
            'projectId': this.#projectId,
            'data': requestDataList
        }
        const url = TABLE_TABS[this.#tabKey].REQUEST_URL;
        let response = null;
        try {
            response = await axios.post(url, data );
        } catch (err) {
            console.error(err);
        }
        return response?response.data : null;
    }
}

function exportData() {
    if (!g_accDataTable ) {
        alert('The CSV data is not ready, please generate the data first.')
        return;
    }
    g_accDataTable.exportToCSV();
}

async function importData() {
    let input = document.createElement('input');
    input.type = 'file';
    input.onchange = _ => {
        let fileUpload = Array.from(input.files);
        var regex = /^([a-zA-Z0-9\s_\\.\-:\(\)])+(.csv|.txt)$/;
        if (regex.test(fileUpload[0].name.toLowerCase())) {
            if (typeof (FileReader) != "undefined") {
                var reader = new FileReader();
                reader.onload = async function (e) {
                    $("#loadingoverlay").fadeIn()
                    try {
                        await g_accDataTable.importFromCSV(e.target.result);
                        await g_accDataTable.prepareDataAndDraw();
                    } catch (err) {
                        console.warn(err);
                    }
                    $("#loadingoverlay").fadeOut()
                }
                reader.readAsText(fileUpload[0]);
            } else {
                alert("This browser does not support HTML5.");
            }
        } else {
            alert("Please upload a valid CSV file.");
        }
    };
    input.click();
}

export async function refreshTable( accountId = null, projectId=null ) {
    $("#loadingoverlay").fadeIn()
    if( TABLE_TABS[g_accDataTable.tabKey].CATEGORY_NAME=='hub' && projectId ){
        for (let key in TABLE_TABS) {
            if( TABLE_TABS[key].CATEGORY_NAME == 'hub' ){
                $("#" + key).addClass("hidden");
                $("#" + key).removeClass("active");
            }
            else{
                if( TABLE_TABS[key].CATEGORY_DEFAULT )
                    $("#" + key).addClass("active");
                $("#" + key).removeClass("hidden");
            }
        } 
    }
    if (TABLE_TABS[g_accDataTable.tabKey].CATEGORY_NAME == 'project' && !projectId) {
        for (let key in TABLE_TABS) {
            if (TABLE_TABS[key].CATEGORY_NAME == 'hub') {
                $("#" + key).removeClass("hidden");
                if (TABLE_TABS[key].CATEGORY_DEFAULT)
                    $("#" + key).addClass("active");
            }
            else {
                $("#" + key).addClass("hidden");
                $("#" + key).removeClass("active");
            }
        }
    }
    const activeTab = $("ul#adminTableTabs li.active")[0].id;
    g_accDataTable.resetDataInfo( activeTab, accountId, projectId );
    await g_accDataTable.prepareDataAndDraw();
    $("#loadingoverlay").fadeOut()
}

export async function initTableTabs(){
    // add all tabs
    for (let key in TABLE_TABS) {
        $('<li id=' + key + '><a href="accTable" data-toggle="tab">' + TABLE_TABS[key].TAB_NAME + '</a></li>').appendTo('#adminTableTabs');
        $("#" + key).addClass((TABLE_TABS[key].CATEGORY_NAME == 'hub' && TABLE_TABS[key].CATEGORY_DEFAULT) ? "active" : "hidden");
    } 
    // event on the tabs
    $('a[data-toggle="tab"]').on('shown.bs.tab', async function (e) {
        $("#loadingoverlay").fadeIn()
        try {
            const activeTab = e.target.parentElement.id;
            g_accDataTable.resetDataInfo(activeTab);
            await g_accDataTable.prepareDataAndDraw();
        } catch (err) {
            console.warn(err);
        }    
        $("#loadingoverlay").fadeOut()
    });  
}

var g_accDataTable = new Table('#accTable' );
