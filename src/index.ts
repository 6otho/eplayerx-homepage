// ==========================================
// 🔥 改造后的首页：包含可视化的 Trakt 热门海报墙
// ==========================================
app.get("/", (c) => {
	const html = `
	<!DOCTYPE html>
	<html lang="zh-CN">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>EPlayerX 主页</title>
		<style>
			body {
				margin: 0;
				padding: 20px;
				font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
				background-color: #121212; /* 深色高级背景 */
				color: #ffffff;
			}
			h1 {
				text-align: center;
				color: #e50914; /* 类似 Netflix 的红色 */
			}
			.module-title {
				margin-top: 40px;
				font-size: 24px;
				border-left: 5px solid #ed1c24; /* Trakt 红色 */
				padding-left: 10px;
			}
			/* 海报横向滑动容器 */
			.poster-container {
				display: flex;
				overflow-x: auto;
				gap: 20px;
				padding: 20px 0;
				scrollbar-width: thin;
				scrollbar-color: #555 #121212;
			}
			.poster-container::-webkit-scrollbar {
				height: 8px;
			}
			.poster-container::-webkit-scrollbar-thumb {
				background: #555;
				border-radius: 4px;
			}
			/* 单个海报卡片 */
			.movie-card {
				flex: 0 0 160px;
				display: flex;
				flex-direction: column;
				transition: transform 0.3s ease;
			}
			.movie-card:hover {
				transform: scale(1.05); /* 鼠标放上去放大效果 */
			}
			.movie-poster {
				width: 160px;
				height: 240px;
				border-radius: 10px;
				object-fit: cover;
				box-shadow: 0 4px 10px rgba(0,0,0,0.5);
			}
			.movie-title {
				margin-top: 10px;
				font-size: 15px;
				font-weight: bold;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.movie-watchers {
				font-size: 12px;
				color: #ffaa00;
				margin-top: 5px;
			}
			.loading {
				text-align: center;
				color: #888;
				margin-top: 50px;
			}
		</style>
	</head>
	<body>

		<h1>🎬 EPlayerX 影音主页</h1>
		
		<div class="module-title">🔥 Trakt 全球热门影视</div>
		
		<!-- 存放海报的容器 -->
		<div id="trakt-list" class="poster-container">
			<div class="loading">正在拼命加载 Trakt 热门数据和海报...</div>
		</div>

		<script>
			// 网页加载后，立刻去请求咱们刚才写好的后端接口！
			fetch('/trakt/trending')
				.then(response => response.json())
				.then(result => {
					const container = document.getElementById('trakt-list');
					container.innerHTML = ''; // 清空加载提示

					if(result.success && result.data.length > 0) {
						// 循环生成海报卡片
						result.data.forEach(movie => {
							const defaultPoster = 'https://via.placeholder.com/160x240/333333/FFFFFF?text=No+Poster';
							const posterSrc = movie.poster ? movie.poster : defaultPoster;
							
							const card = document.createElement('div');
							card.className = 'movie-card';
							card.innerHTML = \`
								<img class="movie-poster" src="\${posterSrc}" alt="\${movie.title}">
								<div class="movie-title" title="\${movie.title}">\${movie.title} (\${movie.year})</div>
								<div class="movie-watchers">👀 \${movie.watchers} 人正在看</div>
							\`;
							container.appendChild(card);
						});
					} else {
						container.innerHTML = '<div class="loading">加载数据失败，请刷新重试。</div>';
					}
				})
				.catch(err => {
					document.getElementById('trakt-list').innerHTML = '<div class="loading">网络请求错误！</div>';
				});
		</script>
	</body>
	</html>
	`;
	
	return c.html(html);
});
// ==========================================
