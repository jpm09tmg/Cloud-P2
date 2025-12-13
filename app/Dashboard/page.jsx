"use client";
import React, { useState, useEffect } from "react";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardFooter } from "./components/DashboardFooter";
import { ChartsGrid } from "./components/ChartsGrid";
import { useUserAuth } from '../_utils/auth-context';
import { redirect } from 'next/navigation';

export default function NutritionalInsights() {
	
	const { user } = useUserAuth();
	const [fullData, setFullData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [dietTypes, setDietTypes] = useState([]);
	const [selectedDiet, setSelectedDiet] = useState('all');
	const [searchKeyword, setSearchKeyword] = useState('');
	const [recipes, setRecipes] = useState([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalRecipes, setTotalRecipes] = useState(0);
	const [searchLoading, setSearchLoading] = useState(false);
	
	const AZURE_FUNCTION_URL = "https://cloud-p3-f2gae3edcxhqd0e6.eastus-01.azurewebsites.net/api";

	console.log("AZURE_FUNCTION_URL =", AZURE_FUNCTION_URL);

	const PAGE_SIZE = 10;

	useEffect(() => {
		if (user) {
			loadDietTypes();
		}
	}, [user]);

	useEffect(() => {
		if (user) {
			loadRecipes();
		}
	}, [selectedDiet, searchKeyword, currentPage, user]);

	const loadDietTypes = async () => {
		try {
			const response = await fetch(`${AZURE_FUNCTION_URL}/GetDietTypes`);
			const data = await response.json();
			if (data.status === 'success') {
				setDietTypes(data.diet_types || []);
			}
		} catch (error) {
			console.error("Error loading diet types:", error);
		}
	};

	const loadRecipes = async () => {
		setSearchLoading(true);
		try {
			const params = new URLSearchParams({
				page: currentPage.toString(),
				page_size: PAGE_SIZE.toString(),
			});

			if (selectedDiet && selectedDiet !== 'all') {
				params.append('diet_type', selectedDiet);
			}
			if (searchKeyword.trim()) {
				params.append('keyword', searchKeyword.trim());
			}

			const response = await fetch(`${AZURE_FUNCTION_URL}/SearchRecipes?${params}`);
			const data = await response.json();

			if (data.status === 'success' && data.results) {
				setRecipes(data.results.items || []);
				setTotalRecipes(data.results.total || 0);
				setTotalPages(data.results.total_pages || 1);
			}
		} catch (error) {
			console.error("Error loading recipes:", error);
			setRecipes([]);
		} finally {
			setSearchLoading(false);
		}
	};

	const fetchNutritionData = async () => {
		setLoading(true);
		try {
			const response = await fetch(`${AZURE_FUNCTION_URL}/ProcessNutrition`);
			const data = await response.json();
			setFullData(data);
		} catch (error) {
			console.error("Error:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSearch = (e) => {
		e.preventDefault();
		setCurrentPage(1);
	};

	const handleDietChange = (diet) => {
		setSelectedDiet(diet);
		setCurrentPage(1);
	};

	const handlePageChange = (newPage) => {
		if (newPage >= 1 && newPage <= totalPages) {
			setCurrentPage(newPage);
		}
	};

	if (!user) {
		redirect('../');
		return null;
	}

	return (
		<div className="min-h-screen bg-gray-50 flex flex-col">
			<DashboardHeader title="Nutritional Insights" />

			<main className="px-8 py-8 grow">
				<ChartsGrid chartData={fullData ? fullData.charts : null} />

				<section className="mb-10">
					<h2 className="text-lg font-semibold mb-3 text-black">API Data Interaction</h2>
					<button onClick={fetchNutritionData} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50">
						{loading ? "Loading..." : "Get Nutritional Insights"}
					</button>
					{fullData && fullData.source && (
						<span className="ml-4 text-sm text-gray-600">
							{fullData.source === 'cache' ? 'From Cache' : 'Freshly Processed'}
						</span>
					)}
				</section>

				<section className="mb-10">
					<h2 className="text-lg font-semibold mb-3 text-black">Search Recipes</h2>
					
					<div className="bg-white rounded-lg shadow p-6 mb-6">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-2">Filter by Diet Type</label>
								<select value={selectedDiet} onChange={(e) => handleDietChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black">
									<option value="all">All Diets</option>
									{dietTypes.map((diet) => (
										<option key={diet} value={diet}>{diet.charAt(0).toUpperCase() + diet.slice(1)}</option>
									))}
								</select>
							</div>

							<div className="md:col-span-2">
								<label className="block text-sm font-medium text-gray-700 mb-2">Search by Recipe Name</label>
								<form onSubmit={handleSearch} className="flex gap-2">
									<input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="Enter recipe name..." className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black" />
									<button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Search</button>
								</form>
							</div>
						</div>

						<div className="mt-4 text-sm text-gray-600">
							Found <span className="font-semibold text-black">{totalRecipes}</span> recipes
							{selectedDiet && selectedDiet !== 'all' && <> in <span className="font-semibold text-black">{selectedDiet}</span> diet</>}
							{searchKeyword && <> matching "<span className="font-semibold text-black">{searchKeyword}</span>"</>}
						</div>
					</div>

					<div className="bg-white rounded-lg shadow overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200">
							<h3 className="text-lg font-semibold text-black">Recipe Results</h3>
						</div>

						{searchLoading ? (
							<div className="p-8 text-center text-gray-500">Loading...</div>
						) : recipes.length === 0 ? (
							<div className="p-8 text-center text-gray-500">No recipes found. Try adjusting your filters.</div>
						) : (
							<div className="hidden md:block overflow-x-auto">
								<table className="w-full">
									<thead className="bg-gray-50">
										<tr>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipe Name</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diet Type</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cuisine</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protein (g)</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carbs (g)</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fat (g)</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200">
										{recipes.map((recipe, index) => (
											<tr key={index} className="hover:bg-gray-50">
												<td className="px-6 py-4 text-sm text-gray-900">{recipe.Recipe_name}</td>
												<td className="px-6 py-4 text-sm"><span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">{recipe.Diet_type}</span></td>
												<td className="px-6 py-4 text-sm text-gray-600">{recipe.Cuisine_type}</td>
												<td className="px-6 py-4 text-sm font-medium text-blue-600">{recipe['Protein(g)']?.toFixed(1) || 'N/A'}</td>
												<td className="px-6 py-4 text-sm font-medium text-green-600">{recipe['Carbs(g)']?.toFixed(1) || 'N/A'}</td>
												<td className="px-6 py-4 text-sm font-medium text-orange-600">{recipe['Fat(g)']?.toFixed(1) || 'N/A'}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>

					{!searchLoading && recipes.length > 0 && (
						<div className="mt-6 flex items-center justify-between bg-white px-6 py-4 rounded-lg shadow">
							<div className="text-sm text-gray-700">Page <span className="font-semibold text-black">{currentPage}</span> of <span className="font-semibold text-black">{totalPages}</span></div>
							<div className="flex gap-2">
								<button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
								<div className="hidden sm:flex gap-2">
									{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
										const page = i + 1;
										return (
											<button key={page} onClick={() => handlePageChange(page)} className={`px-4 py-2 rounded ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{page}</button>
										);
									})}
								</div>
								<button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
							</div>
						</div>
					)}
				</section>

				{fullData && (
					<section className="mt-10">
						<h2 className="text-lg font-semibold mb-3 text-black">Function Metadata</h2>
						<div className="bg-white rounded-lg shadow p-6">
							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-black">
								<div><p className="text-sm text-gray-600">Execution Time</p><p className="text-xl font-bold text-blue-600">{fullData.execution_time_seconds}s</p></div>
								<div><p className="text-sm text-gray-600">Total Records</p><p className="text-xl font-bold text-green-600">{fullData.metadata.total_records.toLocaleString()}</p></div>
								<div><p className="text-sm text-gray-600">Diet Types</p><p className="text-xl font-bold text-purple-600">{fullData.metadata.diet_types}</p></div>
								<div><p className="text-sm text-gray-600">Data Source</p><p className="text-sm font-semibold text-orange-600 mt-2">{fullData.metadata.data_source}</p></div>
							</div>
						</div>
					</section>
				)}
			</main>

			<DashboardFooter />
		</div>
	);
}
