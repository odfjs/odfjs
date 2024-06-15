<script>
	import getTableRawContentFromFile from './getTableRawContentFromFile.js'

	const ODS_TYPE = "application/vnd.oasis.opendocument.spreadsheet";
	const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

	let files

	let tableRawContent;

	/** @type {File} */
	$: file = files && files[0]
	$: console.log('file', file)
	$: tableRawContent = file && getTableRawContentFromFile(file)
	$: console.log('tableRawContent', tableRawContent)

</script>

<h1>Import fichier .ods et .xslx</h1>

<section>
	<label>
		Fichier à importer:
		<input bind:files type="file" id="file-input" accept="{ ['.ods', '.xlsx', ODS_TYPE, XLSX_TYPE].join(',') }" />
	</label>
</section>



<style lang="scss">
	
	:global(main) {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;

		@media (min-width: 640px) {
			max-width: none;
		}
	}
	
</style>
