import azure.functions as func
from azure.storage.blob import BlobServiceClient
from azure.cosmos import CosmosClient
import pandas as pd
import io
import json
import os
from datetime import datetime

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# Cosmos DB helper
class DatabaseHelper:
    def __init__(self):
        endpoint = os.environ.get('COSMOS_ENDPOINT')
        key = os.environ.get('COSMOS_KEY')
        
        if not endpoint or not key:
            self.client = None
            return
        
        self.client = CosmosClient(endpoint, key)
        self.database = self.client.get_database_client('NutritionDB')
        self.cache_container = self.database.get_container_client('Cached')
        self.data_container = self.database.get_container_client('Cleaned')
    
    def get_cached(self, key):
        if not self.client:
            return None
        try:
            return self.cache_container.read_item(item=key, partition_key=key)
        except:
            return None
    
    def save_cached(self, key, data):
        if not self.client:
            return
        try:
            item = {'id': key, 'dataType': key, 'data': data, 'timestamp': str(datetime.now())}
            self.cache_container.upsert_item(body=item)
        except:
            pass
    
    def save_data(self, df):
        if not self.client:
            return
        try:
            # Sample evenly across all diet types (20 per diet)
            sample_per_diet = 20
            sampled = df.groupby('Diet_type').head(sample_per_diet)
            records = sampled.to_dict('records')
            
            print(f"Saving {len(records)} sampled recipes to Cosmos DB")
            
            for idx, record in enumerate(records):
                record['id'] = f"{record.get('Diet_type', 'unknown')}_{idx}"
                record['diet_type'] = record.get('Diet_type', 'unknown')
                try:
                    self.data_container.upsert_item(body=record)
                except:
                    pass
            
            print(f"Saved {len(records)} recipes successfully")
        except Exception as e:
            print(f"Error saving data: {e}")
    
    def search_recipes(self, diet_type=None, keyword=None, page=1, page_size=10):
        if not self.client:
            return {'items': [], 'total': 0, 'page': 1, 'page_size': page_size, 'total_pages': 0}
        
        try:
            query = "SELECT * FROM c WHERE 1=1"
            params = []
            
            if diet_type and diet_type.lower() != 'all':
                query += " AND c.Diet_type = @diet_type"
                params.append({"name": "@diet_type", "value": diet_type})
            
            if keyword:
                query += " AND CONTAINS(LOWER(c.Recipe_name), @keyword)"
                params.append({"name": "@keyword", "value": keyword.lower()})
            
            items = list(self.data_container.query_items(
                query=query,
                parameters=params if params else None,
                enable_cross_partition_query=True
            ))
            
            total = len(items)
            start = (page - 1) * page_size
            end = start + page_size
            
            return {
                'items': items[start:end],
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': (total + page_size - 1) // page_size
            }
        except:
            return {'items': [], 'total': 0, 'page': 1, 'page_size': page_size, 'total_pages': 0}

db = None

def get_db():
    global db
    if db is None:
        db = DatabaseHelper()
    return db

# Blob Trigger - runs when CSV changes
@app.blob_trigger(arg_name="myblob", path="nutrition-data/All_Diets.csv", connection="AzureWebJobsStorage")
def DataCleaningTrigger(myblob: func.InputStream):
    print(f"Blob trigger activated: {myblob.name}")
    
    try:
        db = get_db()
        
        csv_data = myblob.read()
        df = pd.read_csv(io.BytesIO(csv_data))
        print(f"Loaded {len(df)} rows")
        
        # Clean data
        numeric_cols = ['Protein(g)', 'Carbs(g)', 'Fat(g)']
        df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
        
        # Save to database
        db.save_data(df)
        
        # Cache results
        avg_macros = df.groupby('Diet_type')[numeric_cols].mean()
        avg_macros_dict = avg_macros.reset_index().to_dict('records')
        db.save_cached('avg_macros', avg_macros_dict)
        
        print("Processing complete")
    except Exception as e:
        print(f"Error: {str(e)}")

# Main data processing endpoint
@app.route(route="ProcessNutrition", methods=["GET", "POST"])
def ProcessNutrition(req: func.HttpRequest) -> func.HttpResponse:
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    }
    
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=200, headers=headers)
    
    try:
        start_time = datetime.now()
        db = get_db()
        
        # Try cache first
        cached = db.get_cached('full_data')
        if cached:
            cached['source'] = 'cache'
            cached['timestamp'] = str(datetime.now())
            return func.HttpResponse(json.dumps(cached), mimetype="application/json", status_code=200, headers=headers)
        
        # Process if not cached
        connect_str = os.environ.get('AzureWebJobsStorage')
        if not connect_str or connect_str == 'UseDevelopmentStorage=true':
            connect_str = "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;AccountName=devstoreaccount1;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"
        
        blob_service = BlobServiceClient.from_connection_string(connect_str)
        blob_client = blob_service.get_container_client('nutrition-data').get_blob_client('All_Diets.csv')
        
        stream = blob_client.download_blob().readall()
        df = pd.read_csv(io.BytesIO(stream))
        
        numeric_cols = ['Protein(g)', 'Carbs(g)', 'Fat(g)']
        df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())
        
        avg_macros = df.groupby('Diet_type')[numeric_cols].mean()
        recipe_counts = df['Diet_type'].value_counts()
        correlation = df[numeric_cols].corr()
        
        bar_data = [{'diet': dt, 'protein': round(row['Protein(g)'], 2), 'carbs': round(row['Carbs(g)'], 2), 'fat': round(row['Fat(g)'], 2)} for dt, row in avg_macros.iterrows()]
        pie_data = [{'name': dt, 'value': int(cnt)} for dt, cnt in recipe_counts.items()]
        scatter_data = [{'protein': round(row['Protein(g)'], 2), 'carbs': round(row['Carbs(g)'], 2), 'diet': row['Diet_type'], 'recipe': row['Recipe_name']} for _, row in df.nlargest(50, 'Protein(g)').iterrows()]
        heatmap_data = [{'x': col, 'y': row, 'value': round(correlation.iloc[i, j], 3)} for i, row in enumerate(correlation.index) for j, col in enumerate(correlation.columns)]
        
        exec_time = (datetime.now() - start_time).total_seconds()
        
        output = {
            'status': 'success',
            'source': 'processed',
            'timestamp': str(datetime.now()),
            'execution_time_seconds': round(exec_time, 2),
            'metadata': {'total_records': len(df), 'diet_types': df['Diet_type'].nunique(), 'cuisine_types': df['Cuisine_type'].nunique(), 'data_source': 'Azure Blob Storage'},
            'insights': {'highest_protein_diet': avg_macros['Protein(g)'].idxmax(), 'highest_carb_diet': avg_macros['Carbs(g)'].idxmax(), 'highest_fat_diet': avg_macros['Fat(g)'].idxmax(), 'total_recipes': len(df)},
            'charts': {'barChart': {'title': 'Average Macronutrients', 'data': bar_data}, 'pieChart': {'title': 'Recipe Distribution', 'data': pie_data}, 'scatterPlot': {'title': 'Protein vs Carbs', 'data': scatter_data}, 'heatmap': {'title': 'Nutrient Correlation', 'data': heatmap_data}},
            'topProteinRecipes': df.nlargest(10, 'Protein(g)')[['Recipe_name', 'Diet_type', 'Protein(g)']].to_dict('records')
        }
        
        db.save_cached('full_data', output)
        
        return func.HttpResponse(json.dumps(output), mimetype="application/json", status_code=200, headers=headers)
    except Exception as e:
        return func.HttpResponse(json.dumps({"status": "error", "message": str(e)}), mimetype="application/json", status_code=500, headers=headers)

# Search with filter and pagination
@app.route(route="SearchRecipes", methods=["GET"])
def SearchRecipes(req: func.HttpRequest) -> func.HttpResponse:
    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    
    try:
        diet_type = req.params.get('diet_type')
        keyword = req.params.get('keyword')
        page = int(req.params.get('page', 1))
        page_size = int(req.params.get('page_size', 10))
        
        db = get_db()
        results = db.search_recipes(diet_type, keyword, page, page_size)
        
        return func.HttpResponse(json.dumps({'status': 'success', 'results': results}), mimetype="application/json", status_code=200, headers=headers)
    except Exception as e:
        return func.HttpResponse(json.dumps({'status': 'error', 'message': str(e)}), status_code=500, headers=headers)

# Get diet types for dropdown
@app.route(route="GetDietTypes", methods=["GET"])
def GetDietTypes(req: func.HttpRequest) -> func.HttpResponse:
    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    diet_types = ['dash', 'keto', 'mediterranean', 'paleo', 'vegan']
    return func.HttpResponse(json.dumps({'status': 'success', 'diet_types': diet_types}), status_code=200, headers=headers)

# Health check
@app.route(route="health", methods=["GET"])
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    db = get_db()
    return func.HttpResponse(json.dumps({"status": "healthy", "timestamp": str(datetime.now()), "cosmos_db": "connected" if db.client else "not configured"}), status_code=200, headers=headers)