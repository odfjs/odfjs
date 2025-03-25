<script>
	//@ts-check

	import {tableRawContentToObjects, tableWithoutEmptyRows, getODSTableRawContent, getXLSXTableRawContent, createOdsFile} from './browser.js'

	const ODS_TYPE = "application/vnd.oasis.opendocument.spreadsheet";
	const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

	/**
	 * 
	 * @param {File} file 
	 * @returns {Promise<Map<SheetName, SheetRawContent>>}
	 */
	async function getTableRawContentFromFile(file){
		if(file.type === ODS_TYPE)
			return getODSTableRawContent(await file.arrayBuffer())

		if(file.type === XLSX_TYPE)
			return getXLSXTableRawContent(await file.arrayBuffer())

		throw new TypeError(`Unsupported file type: ${file.type} (${file.name})`)
	}

	let files

	let tableRawContent;

	/** @type {File} */
	$: file = files && files[0]
	$: tableRawContent = file && getTableRawContentFromFile(file)
	$: tableObjectSheets = tableRawContent && tableRawContent.then(tableWithoutEmptyRows).then(tableRawContentToObjects) || []
	$: Promise.resolve(tableObjectSheets).then(x => console.log('tableObjectSheets', x))

	// ligne inutile qui utilise createOdsFile pour l'importer dans le bundle
	$: tableRawContent && tableRawContent.then(createOdsFile).then(ab => console.log('length', ab.byteLength))

</script>

<h1>Import fichier .ods et .xslx</h1>

<section>
	<h2>Import</h2>
	<label>
		Fichier à importer:
		<input bind:files type="file" id="file-input" accept="{ ['.ods', '.xlsx', ODS_TYPE, XLSX_TYPE].join(',') }" />
	</label>
</section>

<section>
	<h2>Résultat</h2>
	{#await tableObjectSheets}
		(fichier en cours d'analyse)
	{:then tableObjectSheets}
		{#each [...tableObjectSheets] as [sheetName, data]}
			<details>
				<summary>{sheetName} ({data.length} lignes)</summary>
				<table>
					<thead>
						<tr>
						{#each Object.keys(data[0]) as column}
							<th>{column}</th>
						{/each}	
						</tr>
					</thead>
					<tbody>
						{#each data as row}
							<tr>
								{#each Object.keys(data[0]) as column}
									<td><div class="cell-content">{row[column]}</div></td>
								{/each}
							</tr>
						{/each}

					</tbody>
				</table>
			</details>	
		{/each}
	{/await}

</section>



<style lang="scss">
	
	:global(main) {
		padding: 1em;
		max-width: 80rem;
		margin: 0 auto;

	}

	table{
		thead{
			tr{
				background: #EEE;
			}
		}

		tr{
			border-bottom: 1px solid #CCC;
		}

		td, th{
			vertical-align: top;
			padding: 0.5rem;
		}

		td{
			.cell-content{
				max-height: 6rem;
				max-width: 16rem;
				overflow: scroll;
			}
		}

	}
	
</style>
