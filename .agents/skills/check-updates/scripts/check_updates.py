import os
import re
import sys
import ssl
import json
import argparse
import subprocess
import urllib.request
import urllib.parse
from functools import cmp_to_key
from concurrent.futures import ThreadPoolExecutor

# Disable SSL verification for Python on macOS
ssl._create_default_https_context = ssl._create_unverified_context


def parse_version(v):
    clean_v = re.sub(r'^[v~^>=<\s]+', '', str(v))
    parts = re.split(r'[-.]', clean_v)
    parsed = []
    for p in parts:
        if p.isdigit():
            parsed.append((0, int(p)))
        else:
            subparts = re.findall(r'([a-zA-Z]+)|(\d+)', p)
            for s in subparts:
                if s[0]:
                    parsed.append((1, s[0].lower()))
                elif s[1]:
                    parsed.append((0, int(s[1])))
    return parsed


def compare_versions(v1, v2):
    p1 = parse_version(v1)
    p2 = parse_version(v2)
    
    for item1, item2 in zip(p1, p2):
        if item1 != item2:
            if item1[0] == 0 and item2[0] == 1:
                return 1
            elif item1[0] == 1 and item2[0] == 0:
                return -1
            else:
                if item1[1] < item2[1]:
                    return -1
                else:
                    return 1
                    
    if len(p1) < len(p2):
        next_part = p2[len(p1)]
        if next_part[0] == 1:
            return 1
        else:
            return -1
    elif len(p1) > len(p2):
        next_part = p1[len(p2)]
        if next_part[0] == 1:
            return -1
        else:
            return 1
    return 0


def is_stable(v):
    v_lower = str(v).lower()
    for word in ['alpha', 'beta', 'rc', 'dev', 'preview', 'snapshot', 'canary', 'next', 'experimental']:
        if word in v_lower:
            return False
    return True


def get_version_triplet(v):
    clean_v = re.sub(r'^[v~^>=<\s]+', '', str(v))
    m = re.match(r'^(\d+)(?:\.(\d+))?(?:\.(\d+))?', clean_v)
    if m:
        major = int(m.group(1)) if m.group(1) is not None else 0
        minor = int(m.group(2)) if m.group(2) is not None else 0
        patch = int(m.group(3)) if m.group(3) is not None else 0
        return major, minor, patch
    return 0, 0, 0


def classify_update(current, target):
    c_maj, c_min, c_pat = get_version_triplet(current)
    t_maj, t_min, t_pat = get_version_triplet(target)
    if t_maj > c_maj:
        return "Major"
    elif t_min > c_min:
        return "Minor"
    elif t_pat > c_pat:
        return "Patch"
    return "Same"


def fetch_json(url):
    req = urllib.request.Request(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Accept': 'application/json'
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception:
        return None


def fetch_npm_package_info(pkg_name):
    quoted = urllib.parse.quote(pkg_name, safe="")
    
    # 1. Fetch dist-tags (compact: few hundred bytes)
    tags_url = f"https://registry.npmjs.org/-/package/{quoted}/dist-tags"
    tags_data = fetch_json(tags_url)
    
    latest_stable = None
    latest_overall = None
    
    if tags_data and isinstance(tags_data, dict):
        latest_stable = tags_data.get('latest')
        all_tags = list(tags_data.values())
        if all_tags:
            sorted_tags = sorted(all_tags, key=cmp_to_key(compare_versions))
            latest_overall = sorted_tags[-1]
            
    # 2. Fallback to /latest endpoint if dist-tags endpoint fails
    if not latest_stable:
        latest_url = f"https://registry.npmjs.org/{quoted}/latest"
        latest_data = fetch_json(latest_url)
        if latest_data and 'version' in latest_data:
            latest_stable = latest_data['version']
            latest_overall = latest_stable

    return pkg_name, latest_stable, latest_overall or latest_stable


def check_npm_dependencies(package_json_path='package.json', update_mode=False, allow_major=True, target_packages=None):
    if not os.path.exists(package_json_path):
        print(f"Error: {package_json_path} not found.")
        return

    with open(package_json_path, 'r', encoding='utf-8') as f:
        pkg_data = json.load(f)

    deps = pkg_data.get('dependencies', {})
    dev_deps = pkg_data.get('devDependencies', {})

    all_pkgs = list(deps.keys()) + list(dev_deps.keys())
    if target_packages:
        all_pkgs = [p for p in all_pkgs if p in target_packages]

    if not all_pkgs:
        print("No matching dependencies found in package.json.")
        return

    print(f"Checking {len(all_pkgs)} npm packages against registry...")
    results_map = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        for pkg_name, latest_stable, latest_overall in executor.map(fetch_npm_package_info, all_pkgs):
            results_map[pkg_name] = (latest_stable, latest_overall)

    updates_to_apply = {}

    def process_section(title, section_dict, section_key):
        nonlocal updates_to_apply
        filtered_dict = {k: v for k, v in section_dict.items() if (not target_packages or k in target_packages)}
        if not filtered_dict:
            return

        print("\n" + "=" * 125)
        print(f"{title}")
        print("=" * 125)
        print(f"{'Package':<32} | {'Current':<14} | {'Latest Stable':<15} | {'Latest Overall':<15} | {'Type':<8} | {'Status'}")
        print("-" * 125)

        for pkg, current_ver in sorted(filtered_dict.items()):
            latest_stable, latest_overall = results_map.get(pkg, (None, None))
            if not latest_stable:
                print(f"{pkg:<32} | {current_ver:<14} | {'Not Found':<15} | {'Not Found':<15} | {'-':<8} | Error: Registry unreachable")
                continue

            cmp_stable = compare_versions(current_ver, latest_stable)
            cmp_overall = compare_versions(current_ver, latest_overall) if latest_overall else 0

            status = "Up-to-date"
            up_type = "None"

            if cmp_stable < 0:
                up_type = classify_update(current_ver, latest_stable)
                status = f"Update Avail ({up_type})"
                if allow_major or up_type != "Major":
                    updates_to_apply[pkg] = (section_key, current_ver, latest_stable)
            elif cmp_overall < 0:
                up_type = "Pre-rel"
                status = "Pre-rel Avail"

            print(f"{pkg:<32} | {current_ver:<14} | {latest_stable:<15} | {(latest_overall or '-'):<15} | {up_type:<8} | {status}")

    process_section("Runtime Dependencies (dependencies)", deps, "dependencies")
    process_section("Development Dependencies (devDependencies)", dev_deps, "devDependencies")

    if update_mode and updates_to_apply:
        print("\n" + "=" * 125)
        print(f"Applying {len(updates_to_apply)} update(s) to package.json...")
        print("=" * 125)
        with open(package_json_path, 'r', encoding='utf-8') as f:
            raw_content = f.read()

        for pkg, (sec, old_ver, new_ver) in updates_to_apply.items():
            prefix_match = re.match(r'^([~^>=<\s]*)', old_ver)
            prefix = prefix_match.group(1) if prefix_match else '^'
            if not prefix:
                prefix = '^'
            updated_str = f"{prefix}{new_ver}"
            
            pattern = rf'("{re.escape(pkg)}"\s*:\s*)"{re.escape(old_ver)}"'
            replacement = rf'\g<1>"{updated_str}"'
            new_content = re.sub(pattern, replacement, raw_content)
            if new_content != raw_content:
                raw_content = new_content
                print(f"  ✓ {pkg}: {old_ver} -> {updated_str}")
            else:
                print(f"  ⚠ Could not replace version for {pkg}")

        with open(package_json_path, 'w', encoding='utf-8') as f:
            f.write(raw_content)
        print("\nSuccessfully updated package.json! Run 'npm install && npm run build' to apply and test.")
    elif update_mode:
        print("\nNo updates to apply.")


def check_node_version():
    print("\n" + "=" * 125)
    print("Node.js Runtime & Engine")
    print("=" * 125)
    print(f"{'Target':<32} | {'Current / Local':<14} | {'Latest LTS':<15} | {'Latest Current':<15} | {'Status'}")
    print("-" * 125)

    local_node = "N/A"
    try:
        local_node = subprocess.check_output(['node', '-v'], stderr=subprocess.DEVNULL).decode('utf-8').strip()
    except Exception:
        pass

    nvmrc = "None"
    if os.path.exists('.nvmrc'):
        with open('.nvmrc', 'r', encoding='utf-8') as f:
            nvmrc = f.read().strip()

    node_data = fetch_json('https://nodejs.org/dist/index.json')
    latest_lts = "N/A"
    latest_current = "N/A"

    if node_data and isinstance(node_data, list):
        latest_current = node_data[0].get('version', 'N/A')
        for item in node_data:
            if item.get('lts'):
                latest_lts = f"{item.get('version')} ({item.get('lts')})"
                break

    print(f"{'Local Runtime (node -v)':<32} | {local_node:<14} | {latest_lts:<15} | {latest_current:<15} | {'Active'}")
    print(f"{'.nvmrc Configuration':<32} | {nvmrc:<14} | {latest_lts:<15} | {latest_current:<15} | {'Configured'}")


def check_github_actions():
    import glob
    workflow_files = glob.glob('.github/workflows/*.yml') + glob.glob('.github/workflows/*.yaml')
    if not workflow_files:
        return

    actions_found = {}
    for path in workflow_files:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                m = re.search(r'uses:\s*([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+(?:/[a-zA-Z0-9_.-]+)?)\s*@\s*([a-zA-Z0-9_.-]+)', line)
                if m:
                    full_action, current_ver = m.group(1), m.group(2)
                    parts = full_action.split('/')
                    gh_repo = f"{parts[0]}/{parts[1]}"
                    if full_action not in actions_found:
                        actions_found[full_action] = {'current_ver': current_ver, 'gh_repo': gh_repo, 'files': set()}
                    actions_found[full_action]['files'].add(path)

    if not actions_found:
        return

    print("\n" + "=" * 125)
    print("GitHub Actions Workflows")
    print("=" * 125)
    print(f"{'Action':<35} | {'Current':<15} | {'Latest Release':<15} | {'Status':<15} | {'Files'}")
    print("-" * 125)

    for full_action, info in sorted(actions_found.items()):
        gh_repo = info['gh_repo']
        current_ver = info['current_ver']
        files_str = ", ".join(sorted(info['files']))

        url = f"https://api.github.com/repos/{gh_repo}/releases/latest"
        data = fetch_json(url)
        latest_tag = data.get('tag_name') if data else None

        status = "Up-to-date" if (latest_tag and latest_tag == current_ver) else "Update Avail"
        print(f"{full_action:<35} | {current_ver:<15} | {(latest_tag or 'N/A'):<15} | {status:<15} | {files_str}")


def main():
    parser = argparse.ArgumentParser(description="Check and update project dependencies for AI Interview Simulator.")
    parser.add_argument("-u", "--update", action="store_true", help="Automatically write stable updates to package.json")
    parser.add_argument("--no-major", action="store_true", help="Exclude major version updates when running with --update")
    parser.add_argument("-p", "--packages", nargs="*", help="Filter check / update to specific package names")
    args = parser.parse_args()

    check_npm_dependencies(
        update_mode=args.update,
        allow_major=not args.no_major,
        target_packages=args.packages
    )
    check_node_version()
    check_github_actions()


if __name__ == '__main__':
    main()
